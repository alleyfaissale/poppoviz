"""Enrichit un CSV de logs POPPY : ajoute iteration, data_center, step et time_ms,
puis produit un fichier agrégé par (iteration, data_center, step) et la fuite cumulée."""
import sys
import pandas as pd

entree = sys.argv[1]
sortie_enrichie = sys.argv[2] if len(sys.argv) > 2 else "logs_enrichis.csv"
sortie_agregee = sys.argv[3] if len(sys.argv) > 3 else "logs_agreges.csv"
NB_DC = 5

df = pd.read_csv(entree, dtype=str)
df["time"] = pd.to_numeric(df["time"])
df["iteration"] = df["run"].astype(int)

# Lignes de fin d'exécution, communes à tous les data centers
FINAL_OPS = {"EVAL_DC", "NORM", "ADD_SCALAR", "ADD", "MUL", "ROT", "FAST_ROT",
             "MUL_SCALAR", "MUL_PLAIN", "ENCODE", "ENCRYPT"}


def step_de(op, it):
    if it == 0:
        return "INIT"
    if op == "SYNC" or op.endswith("_SYNC"):
        return "SYNC"
    if op == "EVAL_OP" or op.endswith("_COMPUTE"):
        return "EVAL_OP"
    if op == "PREP" or op.endswith("_PREP"):
        return "PREP"
    if op == "BOOTSTRAP":
        return "BOOTSTRAP"
    if op in ("MEMORY", "MEMORY_PEAK"):
        return "MEMORY"
    if op in FINAL_OPS or op.endswith("_NORM"):
        return "FINAL"
    return None


data_centers, steps = [], []
it_courante, dc_index, en_final, dernier_traitement = None, -1, False, None
for _, ligne in df.iterrows():
    it, op, titre = ligne["iteration"], ligne["operation"], ligne["title"]
    if it != it_courante:  # nouvelle itération : le compteur de data centers repart
        it_courante, dc_index, en_final = it, -1, False
    step = step_de(op, it)

    if it == 0:
        # Avant les itérations : le titre indique parfois "DC n"
        dc = next((f"DC{t}" for t in titre.split() if t.isdigit() and f"DC {t}" in titre), "ALL")
    else:
        if op == "SYNC":  # début d'un nouveau data center
            dc_index += 1
        if step == "FINAL":
            en_final = True  # tout ce qui suit est global
        dc = "ALL" if en_final else f"DC{dc_index}"
        if step == "MEMORY":
            # La mémoire prend le nom du traitement qui la précède :
            # MEMORY_PEAK_SYNC, MEMORY_SYNC, MEMORY_PEAK_PREP, MEMORY_PREP...
            step = "FINAL" if en_final else f"{op}_{dernier_traitement}"
        elif step in ("SYNC", "EVAL_OP", "PREP", "BOOTSTRAP"):
            dernier_traitement = step
    data_centers.append(dc)
    steps.append(step)

df["data_center"] = data_centers
df["step"] = steps

# Temps ramenés en millisecondes
facteurs = {"SECONDS": 1000, "MILLISECONDS": 1, "MICROSECONDS": 0.001}
df["time_ms"] = df.apply(lambda r: r["time"] * facteurs[r["unit"]] if r["unit"] in facteurs else None, axis=1)

# Vérifications
print("Blocs SYNC par itération :", df[df.operation == "SYNC"].groupby("iteration").size().to_dict())
sans_step = df[df.step.isna()]
print("Lignes sans step :", len(sans_step))
if len(sans_step):
    print(sans_step[["title", "operation", "run"]])

colonnes = list(pd.read_csv(entree, nrows=0).columns) + ["iteration", "data_center", "step", "time_ms"]
df[colonnes].to_csv(sortie_enrichie, index=False)

# Agrégation : temps total et nombre d'opérations par type
it_df = df[(df.iteration >= 1) & df.step.isin(["SYNC", "EVAL_OP", "PREP", "BOOTSTRAP"])].copy()
temps = it_df.groupby(["iteration", "data_center", "step"])["time_ms"].sum(min_count=1)
ops = it_df[(it_df.unit == "UNIT") & (it_df.operation != "CIPHER_SYNC")].copy()
ops["type_operation"] = ops["operation"].str.replace(r"_(SYNC|COMPUTE|PREP)$", "", regex=True)
ops_pivot = ops.pivot_table(index=["iteration", "data_center", "step"], columns="type_operation",
                            values="time", aggfunc="sum")
ops_pivot.columns = [f"nb_{c.lower()}" for c in ops_pivot.columns]
agrege = pd.concat([temps.rename("temps_ms"), ops_pivot], axis=1).reset_index()

# Chiffrés reçus (par itération) et fuite cumulée par data center
chiffres = (df[df.operation == "CIPHER_SYNC"].groupby(["iteration", "data_center"])["time"]
            .sum().rename("chiffres_recus").reset_index())
chiffres = chiffres.sort_values(["data_center", "iteration"])
chiffres["cumulative_leakage"] = chiffres.groupby("data_center")["chiffres_recus"].cumsum()
chiffres["step"] = "SYNC"
agrege = agrege.merge(chiffres, on=["iteration", "data_center", "step"], how="left")
agrege = agrege.sort_values(["iteration", "data_center", "step"],
                            key=lambda s: s.map({"SYNC": 0, "EVAL_OP": 1, "BOOTSTRAP": 2, "PREP": 3}) if s.name == "step" else s)
agrege.to_csv(sortie_agregee, index=False)
print(f"Écrit : {sortie_enrichie} ({len(df)} lignes), {sortie_agregee} ({len(agrege)} lignes)")
