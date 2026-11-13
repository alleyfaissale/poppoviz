# Visualisation des logs POPPY

Pour le lancement et le parcours complet, voir [README.md](README.md). Le traitement JavaScript des logs est maintenu dans `assets/logs-core.js` ; le rendu est dans `assets/app.js`.

Ouvrir `poppyviz-students.html`. Au départ, la section « Logs d’exécution POPPY » est vide : seul l’import d’un CSV est proposé (« Importer un log CSV »). Après l’import, choisir une itération et un data center : les mesures s’affichent en dessous. Le prétraitement correspond à `run = 0`.

Le format conserve les huit colonnes du CSV fourni :

`multDepth,batchSize,ringsize,title,operation,unit,time,run`

La colonne `time` contient la valeur de la mesure, y compris lorsqu’il s’agit d’un nombre d’opérations ou d’une quantité de mémoire.

## Enrichissement et agrégation

À l’import, la page applique les règles de `scripts/enrichir_logs_poppy.py`, portées en JavaScript :

- **DC** : le CSV n’a pas de colonne data center. Dans une itération, chaque ligne `SYNC` ouvre un nouveau DC (DC0, DC1…). 
L’interface affiche l’agrégat de l’itération choisie, filtrable par DC, et les lignes brutes enrichies. 

(le script nécessite `pandas`). La numérotation DC0… des logs est indépendante des DC dessinés sur la carte.

Un nouvel import remplace les logs affichés. Une erreur de format laisse les dernières données valides affichées.

## Fond cartographique

Le graphe est superposé à une carte MapLibre GL JS via le module officiel `@sigma/layer-maplibre` (adaptation locale dans `vendor/`). Les continents ont des couleurs différentes. Le fond utilise les tuiles vectorielles de démonstration MapLibre ; une connexion Internet est nécessaire au chargement des bibliothèques et de la carte.

Les positions sont illustratives : dans l’ordre des DC, Denver (Amérique du Nord), Brasília (Amérique du Sud), Chengdu (Asie), Francfort (Europe) et Sydney (Océanie). La taille de chaque groupe croît avec le nombre de nœuds du DC. 

## Graphe p2p-Gnutella04 (affiché par défaut)

La page affiche à l’ouverture le graphe p2p-Gnutella04 (10 876 nœuds, 39 994 arêtes) réparti entre 5 DC (DC0 à DC4) selon `p2p-Gnutella04-partition4.dot`, le fichier de partition utilisé par POPPY : un `subgraph cluster_k` (`label = "DC k"`) par data center, puis les arêtes `a -> b`. Ce fichier peut aussi être chargé avec « Charger un autre graphe ».

Les arêtes inter-DC (18 082, 45 %) sont masquées ; le bouton « Arêtes inter-DC » les affiche seules, et celles d’un nœud survolé ou sélectionné restent visibles.

