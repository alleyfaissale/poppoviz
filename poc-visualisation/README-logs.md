# Visualisation des logs POPPY

Ouvrir `poppyviz-students.html`. Au départ, la section « Logs d’exécution POPPY » est vide : seul l’import d’un CSV est proposé (« Importer un log CSV »). Après l’import, choisir une itération et un data center : les mesures s’affichent en dessous. Le prétraitement correspond à `run = 0`.

Le fichier `expe_poppy_uj-students-demo.csv` contient des **données fictives** destinées à tester l’interface : aucune exécution de POPPY ni mesure de performance n’a été réalisée. Les paramètres cryptographiques et les valeurs de temps, mémoire et opérations sont illustratifs. Seuls les nombres de nœuds et d’arêtes du prétraitement sont lus dans `students.txt`. Les lignes de démonstration sont marquées `DEMO SYNTHETIQUE`.

Le format conserve les huit colonnes du CSV fourni :

`multDepth,batchSize,ringsize,title,operation,unit,time,run`

La colonne `time` contient la valeur de la mesure, y compris lorsqu’il s’agit d’un nombre d’opérations ou d’une quantité de mémoire.

## Enrichissement et agrégation

À l’import, la page applique les règles de `scripts/enrichir_logs_poppy.py`, portées en JavaScript :

- **DC** : le CSV n’a pas de colonne data center. Dans une itération, chaque ligne `SYNC` ouvre un nouveau DC (DC0, DC1…). Au prétraitement (`run = 0`), le DC est lu dans le titre (« DC 3 ») ou vaut `ALL`. Les totaux de fin d’itération 10 sont rattachés à `ALL`, step `FINAL`. **Hypothèse à confirmer avec la cliente.**
- **Step** : `SYNC`/`*_SYNC` → SYNC, `EVAL_OP`/`*_COMPUTE` → EVAL_OP, `PREP`/`*_PREP` → PREP, `BOOTSTRAP`. Les lignes mémoire prennent le nom du traitement qui précède (`MEMORY_PEAK_SYNC`…).
- **time_ms** : secondes, millisecondes et microsecondes ramenées en millisecondes.
- **Agrégat** par itération × DC × step : temps total, nombre d’opérations par type (lignes `UNIT`), chiffrés reçus (`CIPHER_SYNC`) et fuite cumulée par DC.

L’interface affiche l’agrégat de l’itération choisie, filtrable par DC, et les lignes brutes enrichies. Le bouton « CSV enrichi » télécharge le même fichier enrichi que le script :

```sh
python3 poc-visualisation/scripts/enrichir_logs_poppy.py <entree.csv> <enrichi.csv> <agrege.csv>
```

(le script nécessite `pandas`). La numérotation DC0… des logs est indépendante des DC dessinés sur la carte.

Un nouvel import remplace les logs affichés. Une erreur de format laisse les dernières données valides affichées.

Pour régénérer le fichier de démonstration (à importer ensuite dans la page) :

```sh
python3 poc-visualisation/generate_students_logs.py
```


Les logs ne contiennent ni scores PageRank individuels ni topologie. Leur sélection ne change donc pas le graphe. La section « Simulation PageRank en clair » existante reste un calcul local illustratif, indépendant des mesures importées.

## Fond cartographique

Le graphe est superposé à une carte MapLibre GL JS via le module officiel `@sigma/layer-maplibre` (adaptation locale dans `vendor/`). Les continents ont des couleurs différentes. Le fond utilise les tuiles vectorielles de démonstration MapLibre ; une connexion Internet est nécessaire au chargement des bibliothèques et de la carte.

Les positions sont illustratives : DC1 autour de Denver (Amérique du Nord), DC2 autour de Brasília (Amérique du Sud), DC3 autour de Chengdu (Asie). Pour la liste d’arêtes Students, les nœuds sont distribués de façon stable entre trois DC. Les fichiers contenant une section `[noeuds]` conservent leurs appartenances explicites. Les coordonnées des nœuds sont réparties autour du centre de chaque groupe ; elles ne représentent pas des positions réelles.

La sélection d’un DC affiche uniquement ses nœuds et ses connexions internes ; le Top 10 est filtré de la même manière. Le zoom et le déplacement restent pilotés par Sigma, synchronisé avec le fond de carte. Le bouton de disposition réorganise les nœuds autour de leurs emplacements géographiques.
