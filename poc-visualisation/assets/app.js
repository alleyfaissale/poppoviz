/* Interface PoppyViz. Charger après logs-core.js et les bibliothèques vendor/CDN.
 * Les graphes et résultats intégrés restent dans le HTML pour permettre file://.
 * Voir DOCUMENTATION.md pour le cycle de chargement et les contrats des données. */
// ---------- 1. Lire le fichier texte et construire le graphe (graphology) ----------
// Fichier Graphviz de partition POPPY : un « subgraph cluster_k { label = "DC k"; n; … } »
// par data center, puis les arêtes « a -> b; ». Il donne la répartition réelle des nœuds.
function parseDot(text) {
  const graph = new graphology.DirectedGraph();
  let dc = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^label\s*=\s*"?DC\s*(\d+)"?/i))) dc = "DC" + m[1];
    else if (/^}/.test(line)) dc = null;
    else if ((m = line.match(/^"?([\w.-]+)"?\s*->\s*"?([\w.-]+)"?/))) {
      const [, s, t] = m;
      if (s === t) continue;
      if (!graph.hasNode(s)) graph.addNode(s, { dc: "?" });
      if (!graph.hasNode(t)) graph.addNode(t, { dc: "?" });
      if (!graph.hasEdge(s, t)) graph.addEdge(s, t);
    } else if (dc && (m = line.match(/^"?([\w.-]+)"?\s*;?$/))) {
      graph.mergeNode(m[1], { dc });
    }
  }
  if (graph.order === 0) throw new Error("Aucun nœud trouvé dans ce fichier .dot.");
  return graph;
}

function parseGraph(text) {
  if (/^\s*(strict\s+)?digraph\b/i.test(text)) return parseDot(text);
  const graph = new graphology.DirectedGraph();
  let section = "aretes";
  const dcOf = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("%")) continue;
    if (/^\[noeuds\]$/i.test(line)) { section = "noeuds"; continue; }
    if (/^\[aretes\]$/i.test(line)) { section = "aretes"; continue; }
    const parts = line.split(/[\s,;]+/);
    if (section === "noeuds") {
      dcOf[parts[0]] = parts[1] || "DC1";
      if (!graph.hasNode(parts[0])) graph.addNode(parts[0]);
    } else {
      const [s, t] = parts;
      if (!s || !t || s === t) continue;
      if (!graph.hasNode(s)) graph.addNode(s);
      if (!graph.hasNode(t)) graph.addNode(t);
      if (!graph.hasEdge(s, t)) graph.addEdge(s, t);
    }
  }
  if (graph.order === 0) throw new Error("Aucun nœud trouvé dans ce fichier.");
  // La même liste d’arêtes conserve les mêmes groupes au rechargement.
  graph.nodes().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((n, i) =>
    graph.setNodeAttribute(n, "dc", dcOf[n] || "DC" + (1 + i % 3)));
  return graph;
}

// ---------- 2. PageRank « en clair », en gardant chaque itération ----------
// Simulation illustrative ; la normalisation des résultats client reste à confirmer.
// Formule locale : PR(v) = (1-d)/N + d * Σ PR(u)/sortant(u),
// la masse des nœuds pendants étant redistribuée à tous.
function pagerankHistory(graph, d = 0.85, maxIter = 100, tol = 1e-8) {
  const nodes = graph.nodes(), N = nodes.length, idx = new Map(nodes.map((n, i) => [n, i]));
  const out = nodes.map((n) => graph.outDegree(n));
  const inn = nodes.map((n) => graph.inNeighbors(n).map((m) => idx.get(m)));
  let pr = new Float64Array(N).fill(1 / N);
  const history = [pr], deltas = [];
  for (let t = 0; t < maxIter; t++) {
    let dang = 0;
    for (let i = 0; i < N; i++) if (out[i] === 0) dang += pr[i];
    const next = new Float64Array(N);
    for (let v = 0; v < N; v++) {
      let s = 0;
      for (const u of inn[v]) s += pr[u] / out[u];
      next[v] = (1 - d) / N + d * (s + dang / N);
    }
    let delta = 0;
    for (let i = 0; i < N; i++) delta += Math.abs(next[i] - pr[i]);
    history.push(next); deltas.push(delta); pr = next;
    if (delta < tol) break;
  }
  return { nodes, history, deltas, converged: deltas.at(-1) < tol };
}

// ---------- 3. Couleurs prises dans le thème (clair / sombre) ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
let C = {};
function readColors() {
  C = { dc: [css("--dc1"), css("--dc2"), css("--dc3"), css("--dc4"), css("--dc5")], inter: css("--inter"), edge: css("--edge"),
        dim: css("--dim"), ink: css("--ink"), muted: css("--muted"), panel: css("--panel"),
        cons: css("--cat-const"), dang: css("--cat-dang"), other: css("--cat-other"), interIn: css("--inter-in") };
}
// Liste calculée une fois par graphe : elle est appelée pour chaque nœud dessiné.
const dcList = () => state.dcs || (state.dcs = [...new Set(state.graph.mapNodes((n, a) => a.dc))].sort());
const dcColor = (dc) => C.dc[dcList().indexOf(dc) % C.dc.length] || C.muted;

// ---------- 4. État de l'application ----------
const state = { graph: null, pr: null, iter: 0, view: "all", focus: "none", hovered: null, selected: null, renderer: null, timer: null };
const $ = (id) => document.getElementById(id);
const fmt = (x) => x.toFixed(4);

function load(text, label, isSample) {
  const graph = parseGraph(text);
  graph.forEachEdge((e, a, s, t) => graph.setEdgeAttribute(e, "inter", graph.getNodeAttribute(s, "dc") !== graph.getNodeAttribute(t, "dc")));
  state.graph = graph;
  state.clientResultsAvailable = text.trim() === $("default-graph").textContent.trim();
  state.dcs = null;
  state.pr = pagerankHistory(graph);
  state.idx = new Map(state.pr.nodes.map((n, i) => [n, i]));
  state.maxPR = Math.max(...state.pr.history.at(-1));
  state.iter = state.pr.history.length - 1;
  state.view = "all"; state.selected = null; state.hovered = null;
  layout();
  $("source-label").textContent = label;
  $("source-badge").hidden = !isSample;
  buildControls(); readColors(); render(); refreshPanels();
}

// Un continent par DC (jusqu'à 5), répartis sur le globe ; l'ordre suit les couleurs des DC
// et des continents du fond de carte. Coordonnées de démonstration, sans lien avec les logs.
const dcLocations = [
  { city: "Denver", continent: "Amérique du Nord", lng: -104.99, lat: 39.74 },
  { city: "Brasília", continent: "Amérique du Sud", lng: -47.88, lat: -15.79 },
  { city: "Chengdu", continent: "Asie", lng: 104.07, lat: 30.67 },
  { city: "Francfort", continent: "Europe", lng: 8.68, lat: 50.11 },
  { city: "Sydney", continent: "Océanie", lng: 145.0, lat: -27.0 },
];
const locationOf = dc => dcLocations[dcList().indexOf(dc) % dcLocations.length];
function layout() {
  const g = state.graph;
  for (const dc of dcList()) {
    const nodes = g.filterNodes((n, a) => a.dc === dc).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const center = locationOf(dc), phase = Math.random() * 2 * Math.PI;
    // Rayon (en degrés) croissant avec la taille du DC : les gros DC occupent plus de place.
    const maxSize = Math.max(...dcList().map(d => g.filterNodes((n, a) => a.dc === d).length));
    const spread = 7 + 13 * Math.sqrt(nodes.length / maxSize);
    nodes.forEach((n, i) => {
      const angle = phase + i * Math.PI * (3 - Math.sqrt(5));
      const radius = spread * Math.sqrt((i + .5) / nodes.length);
      const lng = center.lng + radius * Math.cos(angle);
      const lat = center.lat + radius * Math.sin(angle) * .65;
      // Positions provisoires avant la projection Mercator du module officiel.
      g.mergeNodeAttributes(n, { lng, lat, x: lng, y: lat });
    });
  }
}

function mapStyle() {
  return {
    version: 8,
    sources: { world: { type: "vector", url: "https://demotiles.maplibre.org/tiles/tiles.json" } },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#e5f1fa" } },
      { id: "continents", type: "fill", source: "world", "source-layer": "countries",
        paint: { "fill-color": ["match", ["get", "CONTINENT"],
          "North America", "#c3d7f3", "South America", "#bce3d1", "Asia", "#f2dfb2",
          "Europe", "#ddd3ec", "Africa", "#eed2be", "Oceania", "#c8e2df", "#e3e6e8"] } },
      { id: "borders", type: "line", source: "world", "source-layer": "countries",
        paint: { "line-color": "#ffffff", "line-width": .7, "line-opacity": .8 } },
    ],
  };
}
function updateDCMarkers() {
  if (!state.mapLayer) return;
  for (const marker of $("dc-markers").children) {
    const dc = marker.dataset.dc, location = locationOf(dc);
    marker.hidden = state.view !== "all" && state.view !== dc;
    const graphPoint = SigmaMaplibre.latlngToGraph(state.mapLayer.map, { lng: location.lng, lat: location.lat - 12 });
    const point = state.renderer.graphToViewport(graphPoint);
    marker.style.left = point.x + "px";
    marker.style.top = point.y + "px";
    marker.style.color = dcColor(dc);
  }
}
function bindGeography() {
  $("map-error").hidden = true;
  try {
    state.mapLayer = SigmaMaplibre.bindMaplibreLayer(state.renderer, {
      mapOptions: { style: mapStyle(), interactive: false, attributionControl: false, renderWorldCopies: false },
    });
    state.renderer.refresh();
    state.mapLayer.map.on("error", () => {
      $("map-error").textContent = "Fond de carte indisponible. Vérifiez votre connexion Internet.";
      $("map-error").hidden = false;
    });
    state.mapLayer.map.on("idle", () => { $("map-error").hidden = true; });
    $("dc-markers").replaceChildren(...dcList().map(dc => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "dc-marker";
      marker.dataset.dc = dc;
      marker.textContent = dc + " · " + locationOf(dc).city;
      marker.title = "Afficher " + dc + " et ses statistiques";
      marker.addEventListener("click", () => openStats(dc));
      return marker;
    }));
    state.renderer.on("afterRender", updateDCMarkers);
    updateDCMarkers();
  } catch (error) {
    $("map-error").textContent = "Impossible d’initialiser la carte : " + error.message;
    $("map-error").hidden = false;
  }
}

// ---------- 5. Dessin avec sigma.js (les « reducers » décident de l'apparence) ----------
function visibleInView(node) {
  return state.view === "all" || state.graph.getNodeAttribute(node, "dc") === state.view ? "own" : "hidden";
}

function render() {
  const g = state.graph;
  if (state.mapLayer) { state.mapLayer.clean(); state.mapLayer = null; }
  if (state.renderer) state.renderer.kill();
  state.renderer = new Sigma(g, $("sigma"), {
    defaultEdgeType: "arrow",
    labelRenderedSizeThreshold: 9,
    labelFont: "IBM Plex Sans, system-ui, sans-serif",
    labelColor: { color: "#000000" },
    zIndex: true,
    nodeReducer: (n, a) => {
      const res = { ...a };
      const i = state.idx.get(n);
      const p = state.pr.history[state.iter][i];
      res.size = 2 + 5 * Math.sqrt(p / state.maxPR);
      res.color = dcColor(a.dc);
      res.label = n;
      const vis = visibleInView(n);
      if (vis === "hidden") { res.hidden = true; return res; }
      const focusNode = state.hovered || state.selected;
      if (focusNode) {
        if (n !== focusNode && !g.areNeighbors(n, focusNode)) { res.color = C.dim; res.label = ""; res.zIndex = 0; }
        else { res.zIndex = 2; res.forceLabel = true; }
      } else if (state.focus === "dang" && g.outDegree(n) !== 0) { res.color = C.dim; res.label = ""; }
      else if (state.focus === "const" && g.inDegree(n) !== 0) { res.color = C.dim; res.label = ""; }
      else if (state.focus === "dang" || state.focus === "const") { res.forceLabel = true; res.zIndex = 2; }
      if (n === state.selected) res.highlighted = true;
      return res;
    },
    edgeReducer: (e, a) => {
      const res = { ...a };
      const [s, t] = g.extremities(e);
      if (visibleInView(s) === "hidden" || visibleInView(t) === "hidden") { res.hidden = true; return res; }
      res.color = a.inter ? C.inter : C.edge;
      res.size = a.inter ? 1.6 : 0.8;
      const focusNode = state.hovered || state.selected;
      if (focusNode) {
        // Nœud survolé ou sélectionné : seules ses arêtes, y compris inter-DC.
        if (s !== focusNode && t !== focusNode) res.hidden = true;
        else res.size = 2;
      } else if (state.focus === "inter") res.hidden = !a.inter;
      // Sinon, les arêtes inter-DC sont masquées : le bouton « Arêtes inter-DC » les montre.
      else if (a.inter) res.hidden = true;
      return res;
    },
  });
  const r = state.renderer;
  bindGeography();
  r.on("enterNode", ({ node }) => { state.hovered = node; showNode(node); r.refresh(); });
  r.on("leaveNode", () => { state.hovered = null; showNode(state.selected); r.refresh(); });
  r.on("clickNode", ({ node }) => { state.selected = state.selected === node ? null : node; showNode(state.selected); r.refresh(); });
  r.on("clickStage", () => { state.selected = null; showNode(null); r.refresh(); });
}

// ---------- 6. Panneaux ----------
function buildControls() {
  const view = $("view");
  view.innerHTML = '<option value="all">Vue globale (tout le graphe)</option>' +
    dcList().map((d) => `<option value="${d}">Vue de ${d} · ${locationOf(d).continent}</option>`).join("");
  view.value = state.view;
  const it = $("iter");
  it.max = state.pr.history.length - 1; it.value = state.iter;
}

// ---------- 6 bis. Statistiques descriptives de la vue (graphe complet ou DC choisi) ----------
// Degrés calculés sur le graphe complet : un nœud qui ne reçoit que des arêtes inter-DC
// n'est pas constant. Arête locale = deux extrémités dans le même DC.
function computeStats(view) {
  const g = state.graph, inView = n => view === "all" || g.getNodeAttribute(n, "dc") === view;
  const s = { nodes: 0, cons: 0, dang: 0, other: 0, kmax: 0, local: 0, interOut: 0, interIn: 0 };
  g.forEachNode(n => {
    if (!inView(n)) return;
    const i = g.inDegree(n), o = g.outDegree(n);
    s.nodes++;
    if (i === 0) s.cons++; else if (o === 0) s.dang++; else s.other++;
    s.kmax = Math.max(s.kmax, i);
  });
  g.forEachEdge((e, a, src, tgt) => {
    if (!a.inter) { if (inView(src)) s.local++; }
    else if (inView(src)) s.interOut++;   // vue globale : chaque arête inter-DC comptée une fois ici
    else if (inView(tgt)) s.interIn++;
  });
  return s;
}

const intFmt = new Intl.NumberFormat("fr-FR");
const pct = (v, total) => total ? Math.round(100 * v / total) + " %" : "—";
const charts = {};
// Camembert (anneau) Chart.js + légende HTML avec valeurs et pourcentages.
function drawPie(key, parts) {
  const total = parts.reduce((t, p) => t + p[1], 0);
  $("legend-" + key).innerHTML = parts.map(([label, v, color]) =>
    `<li><i class="dot" style="background:${color}"></i>${label}<span>${intFmt.format(v)} · ${pct(v, total)}</span></li>`).join("");
  if (!window.Chart) return;  // bibliothèque non chargée (hors ligne) : la légende suffit
  const data = { labels: parts.map(p => p[0]),
    datasets: [{ data: parts.map(p => p[1]), backgroundColor: parts.map(p => p[2]), borderColor: C.panel, borderWidth: 2 }] };
  if (charts[key]) { charts[key].data = data; charts[key].update(); return; }
  charts[key] = new Chart($("chart-" + key), { type: "doughnut", data, options: {
    responsive: true, maintainAspectRatio: false, cutout: "55%", animation: { duration: 250 },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c =>
      ` ${c.label} : ${intFmt.format(c.raw)} (${pct(c.raw, c.dataset.data.reduce((t, v) => t + v, 0))})` } } } } });
}

function refreshStats() {
  const g = state.graph, view = state.view, all = view === "all", s = computeStats(view);
  $("stats-scope").textContent = all ? "graphe complet" : view + " · " + locationOf(view).city;
  $("stats-logs").hidden = all;
  $("stats-hist").hidden = all;
  if (all) { closeDCLogs(); closeDCHist(); }
  else {
    if (!$("dc-logs-pop").hidden) refreshDCLogs();
    if (!$("dc-hist-pop").hidden) refreshDCHist();
  }
  const tiles = all
    ? [[s.nodes, "nœuds"], [g.size, "arêtes"], [dcList().length, "data centers"]]
    : [[s.nodes, `nœuds du DC (${pct(s.nodes, g.order)})`], [g.order, "nœuds du graphe"], [s.local + s.interOut + s.interIn, "arêtes touchant le DC"]];
  tiles.push([s.cons, "constants"], [s.dang, "pendants"], [s.kmax, "degré entrant max"]);
  $("stats").innerHTML = tiles.map(([v, l]) => `<div class="stat"><b>${intFmt.format(v)}</b><small>${l}</small></div>`).join("");
  drawPie("nodes", [["Constants", s.cons, C.cons], ["Pendants", s.dang, C.dang], ["Autres", s.other, C.other]]);
  drawPie("edges", all
    ? [["Locales", s.local, C.other], ["Inter-DC", s.interOut, C.inter]]
    : [["Locales", s.local, C.other], ["Inter-DC sortantes", s.interOut, C.inter], ["Inter-DC entrantes", s.interIn, C.interIn]]);
}

// Pop-up de statistiques : bascule sur la vue demandée (« all » ou un DC) puis s'ouvre.
function openStats(view) {
  if (state.view !== view) { $("view").value = view; $("view").dispatchEvent(new Event("change")); }
  $("stats-pop").hidden = false;
  document.querySelector(".stage").classList.add("pop-open");
  refreshStats();  // Chart.js mesure le canevas : redessiner une fois visible
}
function closeStats() {
  closeDCLogs();
  closeDCHist();
  $("stats-pop").hidden = true;
  document.querySelector(".stage").classList.remove("pop-open");
}
$("stats-close").addEventListener("click", closeStats);
$("source-label").addEventListener("click", () => openStats("all"));
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if ($("dc-hist-pop").open) { e.preventDefault(); closeDCHist(); $("stats-hist").focus(); }
  else if (!$("stats-pop").hidden) closeStats();
});

function refreshPanels() {
  refreshStats();

  const legend = dcList().map((d) => `<span><i class="dot" style="background:${dcColor(d)}"></i>${d}</span>`).join("") +
    `<span><i class="bar" style="background:${C.edge}"></i>arête interne</span>` +
    `<span><i class="bar" style="background:${C.inter}"></i>arête inter-DC (masquée ; bouton « Arêtes inter-DC »)</span>` +
    `<span>taille = PageRank</span>`;
  $("legend").innerHTML = legend;

  refreshIter();
}

const clientPageRanks = JSON.parse($("client-pagerank-results").textContent);
const referenceScoreFormat = new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: 7 });
function referenceTopScores(rows, graph, view) {
  return rows.filter(([node, reference]) => reference !== null && graph.hasNode(node)
    && (view === "all" || graph.getNodeAttribute(node, "dc") === view))
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0])).slice(0, 10);
}
function refreshReferenceRanking() {
  $("top").replaceChildren();
  if (!state.clientResultsAvailable) {
    $("reference-ranking-note").textContent = "Les résultats client concernent uniquement p2p-Gnutella04-partition4.dot. Rechargez ce graphe pour consulter son classement.";
    return;
  }
  $("reference-ranking-note").textContent = "Source : err-poppy_uj-p2p-Gnutella04-partition4.dot-1.txt. Deux valeurs invalides : référence du nœud 6067 exclue du tri ; score Poppy du nœud 69 indisponible (—).";
  const scores = referenceTopScores(clientPageRanks, state.graph, state.view);
  $("top").replaceChildren(...scores.map(([node, reference, poppy], index) => {
    const tr = document.createElement("tr");
    tr.dataset.n = node;
    const dc = state.graph.getNodeAttribute(node, "dc");
    const dcCell = cell("");
    const chip = document.createElement("span");
    chip.className = "chip"; chip.style.background = dcColor(dc); chip.textContent = dc;
    dcCell.append(chip);
    tr.append(cell(index + 1, "mono"), cell(node, "mono"), dcCell,
      cell(referenceScoreFormat.format(reference), "num"),
      cell(poppy === null ? "—" : referenceScoreFormat.format(poppy), "num"));
    return tr;
  }));
}

function refreshIter() {
  const { history, deltas } = state.pr;
  const last = history.length - 1;
  $("iter-label").textContent = `itération ${state.iter} / ${last}`;
  $("conv").textContent = state.iter === 0
    ? "Au départ, tous les nœuds ont le même score 1/N."
    : `Variation totale par rapport à l'itération précédente : ${deltas[state.iter - 1].toExponential(2)}` +
      (state.iter === last ? (state.pr.converged ? " (convergé)." : " (arrêt après 100 itérations).") : ".");
  refreshReferenceRanking();
  if (state.renderer) state.renderer.refresh();
  showNode(state.hovered || state.selected);
}

function showNode(n) {
  const box = $("node-info");
  if (!n) { box.textContent = "Survolez ou cliquez un nœud."; return; }
  const g = state.graph, a = g.getNodeAttributes(n);
  const i = state.idx.get(n);
  const kind = g.outDegree(n) === 0 ? "pendant : aucune arête sortante" : g.inDegree(n) === 0 ? "constant : aucune arête entrante" : "ordinaire";
  const interIn = g.inEdges(n).filter((e) => g.getEdgeAttribute(e, "inter")).length;
  const interOut = g.outEdges(n).filter((e) => g.getEdgeAttribute(e, "inter")).length;
  box.innerHTML = `<strong class="mono">${n}</strong> · <span class="chip" style="background:${dcColor(a.dc)}">${a.dc}</span><br>
    PageRank (itération ${state.iter}) : <strong class="mono">${fmt(state.pr.history[state.iter][i])}</strong><br>
    Arêtes entrantes : <span class="mono">${g.inDegree(n)}</span> dont ${interIn} inter-DC · sortantes : <span class="mono">${g.outDegree(n)}</span> dont ${interOut} inter-DC<br>
    Type : ${kind}`;
}

// ---------- 7. Événements ----------
$("iter").addEventListener("input", (e) => { state.iter = +e.target.value; refreshIter(); });
$("play").addEventListener("click", () => {
  if (state.timer) { clearInterval(state.timer); state.timer = null; $("play").textContent = "Lecture"; return; }
  state.iter = 0; $("iter").value = 0; refreshIter();
  $("play").textContent = "Pause";
  state.timer = setInterval(() => {
    if (state.iter >= state.pr.history.length - 1) { clearInterval(state.timer); state.timer = null; $("play").textContent = "Lecture"; return; }
    state.iter++; $("iter").value = state.iter; refreshIter();
  }, 350);
});
$("view").addEventListener("change", (e) => {
  state.view = e.target.value;
  state.hovered = null; state.selected = null;
  refreshStats();
  refreshIter();
  updateDCMarkers();
});
$("focus").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  state.focus = b.dataset.f;
  for (const x of $("focus").querySelectorAll("button")) x.setAttribute("aria-pressed", x === b);
  state.renderer.refresh();
});
$("top").addEventListener("click", (e) => {
  const tr = e.target.closest("tr"); if (!tr) return;
  state.selected = tr.dataset.n; showNode(state.selected); state.renderer.refresh();
});
$("relayout").addEventListener("click", () => {
  layout();
  if (state.mapLayer) state.mapLayer.updateGraphCoordinates(state.graph);
  state.renderer.refresh();
});
$("file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $("err").hidden = true;
  try { load(await f.text(), f.name, false); }
  catch (err) { $("err").textContent = "Impossible de lire ce fichier : " + err.message; $("err").hidden = false; }
});
const onTheme = () => { readColors(); state.renderer.setSetting("labelColor", { color: "#000000" }); refreshPanels(); };
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onTheme);
new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- 10. Export CSV (mêmes fichiers que le script Python) ----------
const csvCell = v => v === null || v === undefined ? "" : /[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const toCSV = (header, rows) => [header, ...rows].map(r => r.map(csvCell).join(",")).join("\n") + "\n";
function downloadCSV(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function enrichedCSV() {
  const cols = ["multDepth", "batchSize", "ringsize", "title", "operation", "unit", "time", "run", "iteration", "data_center", "step", "time_ms"];
  return toCSV(cols, logRows.map(r => cols.map(c => r[c])));
}

// ---------- 11. Affichage des logs ----------
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
function fmtMs(ms) {
  if (ms === null) return "—";
  if (ms < 1000) return nf.format(ms) + " ms";
  if (ms < 60000) return nf.format(ms / 1000) + " s";
  if (ms < 3600000) return nf.format(ms / 60000) + " min";
  return nf.format(ms / 3600000) + " h";
}
const fmtOps = ops => Object.entries(ops).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  .map(([t, n]) => `${t} ${nf.format(n)}`).join(" · ") || "—";

let logRows = [], logAgg = [], logName = "";
function loadLogs(text, name) {
  const rows = enrichLogs(parseLogCSV(text));
  const iterations = [...new Set(rows.map(row => row.run))].sort((a, b) => Number(a) - Number(b));
  logRows = rows;
  logAgg = aggregateLogs(rows);
  logName = name.replace(/\.csv$/i, "");
  $("logs-raw-details").open = false;
  $("dc-logs-raw-details").open = false;
  $("logs-source").textContent = name + (rows.some(row => row.title.includes("DEMO SYNTHETIQUE"))
    ? " — données fictives de démonstration." : " — données importées ; vérifiez leur correspondance avec le graphe.");
  $("logs-empty").hidden = true;
  $("logs-content").hidden = false;
  $("logs-iteration").replaceChildren(...iterations.map(iteration => {
    const option = document.createElement("option");
    option.value = iteration;
    option.textContent = iteration === "0" ? "Prétraitement (run 0)" : "Itération " + iteration;
    return option;
  }));
  $("logs-iteration").value = iterations.find(i => i !== "0") || iterations[0];
  $("logs-error").hidden = true;
  refreshDCOptions();
  refreshLogs();
  if (!$("dc-logs-pop").hidden) refreshDCLogs();
  if (!$("dc-hist-pop").hidden) refreshDCHist();
}

function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

// Liste des DC présents dans l'itération choisie ; conserve le choix courant si possible.
function refreshDCOptions() {
  const iteration = $("logs-iteration").value, previous = $("logs-dc").value;
  const dcs = [...new Set(logRows.filter(r => r.run === iteration).map(r => r.data_center))]
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  $("logs-dc").replaceChildren(...["*", ...dcs].map(dc => {
    const option = document.createElement("option");
    option.value = dc;
    option.textContent = dc === "*" ? "Tous" : dc === "ALL" ? "ALL (global)" : dc;
    return option;
  }));
  $("logs-dc").value = ["*", ...dcs].includes(previous) ? previous : "*";
}

function refreshLogs() {
  renderLogs($("logs-iteration").value, $("logs-dc").value, "logs");
}
function renderLogs(iteration, dc, prefix) {
  const keep = r => dc === "*" || r.data_center === dc;
  const rows = logRows.filter(r => r.run === iteration && keep(r));
  const groups = logAgg.filter(g => String(g.iteration) === iteration && keep(g));
  const label = iteration === "0" ? "le prétraitement" : "l’itération " + iteration;

  // Agrégat : une ligne d'en-tête par DC (chiffrés reçus, fuite cumulée), puis ses steps.
  const trs = [];
  for (const name of [...new Set(groups.map(g => g.data_center))]) {
    const own = groups.filter(g => g.data_center === name);
    const sync = own.find(g => g.step === "SYNC");
    const head = document.createElement("tr");
    head.className = "dc-head";
    const td = cell(name);
    td.colSpan = 3;
    if (sync && sync.chiffres_recus !== null) {
      const span = document.createElement("span");
      span.textContent = ` · ${nf.format(sync.chiffres_recus)} chiffrés reçus · fuite cumulée ${nf.format(sync.cumulative_leakage)}`;
      td.append(span);
    }
    head.append(td);
    trs.push(head);
    for (const g of own) {
      const tr = document.createElement("tr");
      tr.append(cell(g.step), cell(fmtMs(g.temps_ms), "num"), cell(fmtOps(g.ops), "ops"));
      trs.push(tr);
    }
  }
  $(prefix + "-agg").replaceChildren(...trs);
  $(prefix + "-agg-wrap").hidden = !groups.length;
  $(prefix + "-summary").textContent = groups.length
    ? `${rows.length} mesures pour ${label}, agrégées par DC et par step.`
    : `${rows.length} mesures pour ${label}. Pas d’agrégat : voir les lignes brutes.`;

  $(prefix + "-raw-summary").textContent = `Lignes brutes enrichies (${rows.length})`;
  $(prefix + "-values").replaceChildren(...rows.map(row => {
    const tr = document.createElement("tr");
    const title = cell(row.title);
    title.title = `Opération : ${row.operation} · multDepth : ${row.multDepth} · batchSize : ${row.batchSize} · ringsize : ${row.ringsize}`;
    const value = cell(`${row.time} ${row.unit}`, "num");
    if (row.time_ms !== null && row.unit !== "MILLISECONDS") value.title = nf.format(row.time_ms) + " ms";
    tr.append(title, cell(`${row.data_center} · ${row.step ?? "?"}`), value);
    return tr;
  }));
}
// Séries limitées au DC courant ; les lignes globales et les compteurs d’opérations sont exclus.
function histogramData(dc) {
  const groups = logAgg.filter(g => g.data_center === dc && g.iteration > 0);
  const iterations = [...new Set(groups.map(g => g.iteration))].sort((a, b) => a - b);
  const steps = ["SYNC", "BOOTSTRAP", "EVAL_OP", "PREP"];
  const series = steps.map(step => iterations.map(iteration => {
    const value = groups.find(g => g.iteration === iteration && g.step === step)?.temps_ms;
    return value == null ? null : value / 1000;
  }));
  series.push(iterations.map((_, i) => {
    const values = series.slice(0, steps.length).map(values => values[i]).filter(v => v !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }));
  return { iterations, labels: [...steps, "TOTAL"], series };
}
function closeDCHist() {
  if ($("dc-hist-pop").open) $("dc-hist-pop").close();
  $("dc-hist-pop").hidden = true;
  $("stats-hist").setAttribute("aria-expanded", "false");
}
function refreshDCHist() {
  $("dc-hist-scope").textContent = state.view + " · " + locationOf(state.view).city;
  const hasLogs = logRows.length > 0;
  const { iterations, labels, series } = histogramData(state.view);
  const hasTimes = series.some(values => values.some(value => value !== null));
  $("dc-hist-source").textContent = hasLogs ? $("logs-source").textContent : "Aucun fichier de log chargé. Veuillez importer un fichier de log CSV pour afficher l’histogramme de ce data center.";
  $("dc-hist-upload").hidden = hasLogs;
  $("dc-hist-summary").textContent = !hasLogs ? "" : !hasTimes ? "Aucune durée disponible pour ce data center." : "Temps par étape et par itération (secondes).";
  $("dc-hist-values").hidden = !hasTimes;
  $("dc-hist-plot").hidden = !hasTimes || !window.Chart;
  $("dc-hist-table").replaceChildren(...iterations.map((iteration, i) => {
    const tr = document.createElement("tr");
    tr.append(cell(iteration), ...series.map(values => cell(values[i] === null ? "—" : nf.format(values[i]), "num")));
    return tr;
  }));
  if (!hasTimes) return;
  if (!window.Chart) {
    $("dc-hist-summary").textContent = "Le graphique est indisponible. Consultez les valeurs ci-dessous.";
    $("dc-hist-values").open = true;
    return;
  }
  const colors = ["#0084b8", "#ff8700", "#20ad35", "#ef4056", "#9b65c5"];
  const data = { labels: iterations.map(String), datasets: labels.map((label, i) => ({ label, data: series[i], backgroundColor: colors[i] })) };
  if (charts.dcHistogram) charts.dcHistogram.destroy();
  charts.dcHistogram = new Chart($("dc-hist-chart"), { type: "bar", data,
    options: { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 20 } },
      scales: {
        x: { title: { display: true, text: "Itération", color: C.ink }, ticks: { color: C.ink, autoSkip: false, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: "Temps (s)", color: C.ink }, ticks: { color: C.ink } }
      },
      plugins: { legend: { labels: { color: C.ink, boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.dataset.label} : ${nf.format(c.raw)} s` } } }
    }, plugins: [{ id: "durationLabels", afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save(); ctx.fillStyle = C.ink; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
      chart.data.datasets.forEach((dataset, index) => {
        if (!chart.isDatasetVisible(index)) return;
        chart.getDatasetMeta(index).data.forEach((bar, i) => {
          if (dataset.data[i] !== null) ctx.fillText(nf.format(dataset.data[i]), bar.x, bar.y - 5);
        });
      });
      ctx.restore();
    } }]
  });
}
$("stats-hist").addEventListener("click", () => {
  if (!$("dc-hist-pop").hidden) { closeDCHist(); return; }
  closeDCLogs();
  $("dc-hist-pop").hidden = false;
  $("dc-hist-pop").showModal();
  $("dc-hist-values").open = false;
  $("stats-hist").setAttribute("aria-expanded", "true");
  refreshDCHist();
});
$("dc-hist-close").addEventListener("click", () => { closeDCHist(); $("stats-hist").focus(); });
$("dc-hist-upload").addEventListener("click", () => $("logs-file").click());
function closeDCLogs() {
  $("dc-logs-pop").hidden = true;
  $("stats-logs").setAttribute("aria-expanded", "false");
}
function refreshDCLogs() {
  $("dc-logs-scope").textContent = state.view + " · " + locationOf(state.view).city;
  const hasLogs = logRows.length > 0;
  $("dc-logs-source").textContent = hasLogs ? $("logs-source").textContent : "Aucun fichier de log chargé. Veuillez importer un fichier de log CSV pour consulter les logs de ce data center.";
  $("dc-logs-upload").hidden = hasLogs;
  $("dc-logs-iteration-label").hidden = !hasLogs;
  $("dc-logs-iteration").hidden = !hasLogs;
  $("dc-logs-raw-details").hidden = !hasLogs;
  const select = $("dc-logs-iteration"), previous = select.value;
  select.replaceChildren(...Array.from($("logs-iteration").options, option => option.cloneNode(true)));
  select.value = Array.from(select.options).some(option => option.value === previous) ? previous : $("logs-iteration").value;
  select.disabled = !select.options.length;
  renderLogs(select.value, state.view, "dc-logs");
  if (!logRows.length) $("dc-logs-summary").textContent = "Aucune mesure disponible.";
}
$("stats-logs").addEventListener("click", () => {
  if (!$("dc-logs-pop").hidden) { closeDCLogs(); return; }
  closeDCHist();
  $("dc-logs-pop").hidden = false;
  $("dc-logs-raw-details").open = false;
  $("stats-logs").setAttribute("aria-expanded", "true");
  refreshDCLogs();
});
$("dc-logs-upload").addEventListener("click", () => $("logs-file").click());
$("dc-logs-close").addEventListener("click", () => { closeDCLogs(); $("stats-logs").focus(); });
$("dc-logs-iteration").addEventListener("change", () => renderLogs($("dc-logs-iteration").value, state.view, "dc-logs"));
$("logs-form").addEventListener("submit", e => { e.preventDefault(); refreshLogs(); });
$("logs-iteration").addEventListener("change", () => { refreshDCOptions(); refreshLogs(); });
$("logs-dc").addEventListener("change", refreshLogs);
$("logs-dl-enriched").addEventListener("click", () => downloadCSV(logName + "-enrichi.csv", enrichedCSV()));
$("logs-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { loadLogs(await file.text(), file.name); }
  catch (error) {
    $("logs-error").textContent = "Import impossible : " + error.message;
    $("logs-error").hidden = false;
  }
  e.target.value = "";
});

readColors();
load($("default-graph").textContent, $("default-graph").dataset.name, false);
