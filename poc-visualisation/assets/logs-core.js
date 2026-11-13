/* Traitement pur des CSV POPPY. Sans DOM ni dépendance externe.
 * Garder ces règles cohérentes avec scripts/enrichir_logs_poppy.py. */
// ---------- 8. Lecture des mesures POPPY (aucun calcul de l’algorithme) ----------
// CSV à virgules, avec guillemets, guillemets doublés et champs multilignes.
function parseLogCSV(text) {
  const records = [];
  let record = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { record.push(field); field = ""; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      if (record.some(v => v.trim())) records.push(record);
      record = []; field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Champ CSV entre guillemets non fermé.");
  record.push(field);
  if (record.some(v => v.trim())) records.push(record);
  const required = ["multDepth", "batchSize", "ringsize", "title", "operation", "unit", "time", "run"];
  const headers = records.shift()?.map(v => v.trim()) || [];
  if (!required.every(key => headers.includes(key))) throw new Error("Colonnes attendues : " + required.join(", "));
  const rows = records.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`Ligne ${i + 2} : nombre de colonnes incorrect.`);
    const row = Object.fromEntries(headers.map((key, k) => [key, values[k].trim()]));
    if (!/^\d+$/.test(row.run) || !row.time || !Number.isFinite(Number(row.time))) {
      throw new Error(`Ligne ${i + 2} : run ou valeur de mesure invalide.`);
    }
    row.run = String(Number(row.run));
    return row;
  });
  if (!rows.length) throw new Error("Le CSV ne contient aucune mesure.");
  return rows;
}

// ---------- 9. Enrichissement et agrégation des logs ----------
// Portage JavaScript de scripts/enrichir_logs_poppy.py : mêmes règles, mêmes colonnes.
// Le CSV n'a pas de colonne data center : dans une itération, chaque ligne SYNC ouvre un
// nouveau DC (DC0, DC1…). Les lignes de fin d'itération 10 sont globales (ALL, FINAL).
const LOG_STEPS = ["SYNC", "EVAL_OP", "BOOTSTRAP", "PREP"];
const FINAL_OPS = new Set(["EVAL_DC", "NORM", "ADD_SCALAR", "ADD", "MUL", "ROT", "FAST_ROT",
  "MUL_SCALAR", "MUL_PLAIN", "ENCODE", "ENCRYPT"]);
const TIME_FACTORS = { SECONDS: 1000, MILLISECONDS: 1, MICROSECONDS: 0.001 };

function stepOf(op, it) {
  if (it === 0) return "INIT";
  if (op === "SYNC" || op.endsWith("_SYNC")) return "SYNC";
  if (op === "EVAL_OP" || op.endsWith("_COMPUTE")) return "EVAL_OP";
  if (op === "PREP" || op.endsWith("_PREP")) return "PREP";
  if (op === "BOOTSTRAP") return "BOOTSTRAP";
  if (op === "MEMORY" || op === "MEMORY_PEAK") return "MEMORY";
  if (FINAL_OPS.has(op) || op.endsWith("_NORM")) return "FINAL";
  return null;
}

// Ajoute iteration, data_center, step et time_ms à chaque ligne (ordre du fichier conservé).
function enrichLogs(rows) {
  let current = null, dcIndex = -1, inFinal = false, lastStep = null;
  return rows.map(row => {
    const it = Number(row.run), op = row.operation;
    if (it !== current) { current = it; dcIndex = -1; inFinal = false; }  // le compteur de DC repart
    let step = stepOf(op, it), dc;
    if (it === 0) {
      // Avant les itérations : le titre indique parfois « DC n »
      const n = row.title.split(/\s+/).find(t => /^\d+$/.test(t) && row.title.includes("DC " + t));
      dc = n === undefined ? "ALL" : "DC" + n;
    } else {
      if (op === "SYNC") dcIndex++;                // début d'un nouveau data center
      if (step === "FINAL") inFinal = true;        // tout ce qui suit est global
      dc = inFinal ? "ALL" : "DC" + dcIndex;
      // La mémoire prend le nom du traitement qui la précède (MEMORY_PEAK_SYNC, MEMORY_PREP…)
      if (step === "MEMORY") step = inFinal ? "FINAL" : `${op}_${lastStep}`;
      else if (LOG_STEPS.includes(step)) lastStep = step;
    }
    const factor = TIME_FACTORS[row.unit];
    return { ...row, iteration: it, data_center: dc, step,
      time_ms: factor === undefined ? null : Number(row.time) * factor };
  });
}

// Agrégat GROUP BY iteration, data_center, step : temps total, nombre d'opérations par type,
// chiffrés reçus et fuite cumulée (« cumulative leakage ») par DC.
function aggregateLogs(enriched) {
  const groups = new Map();
  for (const r of enriched) {
    if (r.iteration < 1 || !LOG_STEPS.includes(r.step)) continue;
    const k = `${r.iteration}|${r.data_center}|${r.step}`;
    if (!groups.has(k)) groups.set(k, { iteration: r.iteration, data_center: r.data_center, step: r.step,
      temps_ms: null, ops: {}, chiffres_recus: null, cumulative_leakage: null });
    const g = groups.get(k);
    if (r.time_ms !== null) g.temps_ms = (g.temps_ms ?? 0) + r.time_ms;
    if (r.unit === "UNIT" && r.operation !== "CIPHER_SYNC") {
      const type = r.operation.replace(/_(SYNC|COMPUTE|PREP)$/, "").toLowerCase();
      g.ops[type] = (g.ops[type] ?? 0) + Number(r.time);
    }
  }
  const received = new Map();
  for (const r of enriched) {
    if (r.operation !== "CIPHER_SYNC") continue;
    const k = `${r.iteration}|${r.data_center}`;
    received.set(k, (received.get(k) ?? 0) + Number(r.time));
  }
  const totals = {};
  [...received].map(([k, n]) => { const [it, dc] = k.split("|"); return { it: Number(it), dc, n }; })
    .sort((a, b) => a.dc.localeCompare(b.dc) || a.it - b.it)
    .forEach(({ it, dc, n }) => {
      totals[dc] = (totals[dc] ?? 0) + n;
      const g = groups.get(`${it}|${dc}|SYNC`);
      if (g) { g.chiffres_recus = n; g.cumulative_leakage = totals[dc]; }
    });
  return [...groups.values()].sort((a, b) => a.iteration - b.iteration
    || a.data_center.localeCompare(b.data_center, "fr", { numeric: true })
    || LOG_STEPS.indexOf(a.step) - LOG_STEPS.indexOf(b.step));
}

