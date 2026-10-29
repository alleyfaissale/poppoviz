# Visualisation des logs POPPY

Ouvrir `poppyviz-students.html`. Dans la section « Logs d’exécution POPPY », choisir une itération : les mesures s’affichent immédiatement en dessous. Le prétraitement correspond à `run = 0`.

Le fichier `expe_poppy_uj-students-demo.csv` contient des **données fictives** destinées à tester l’interface : aucune exécution de POPPY ni mesure de performance n’a été réalisée. Les paramètres cryptographiques et les valeurs de temps, mémoire et opérations sont illustratifs. Seuls les nombres de nœuds et d’arêtes du prétraitement sont lus dans `students.txt`. Les lignes de démonstration sont marquées `DEMO SYNTHETIQUE`.

Le format conserve les huit colonnes du CSV fourni :

`multDepth,batchSize,ringsize,title,operation,unit,time,run`

La colonne `time` contient la valeur de la mesure, y compris lorsqu’il s’agit d’un nombre d’opérations ou d’une quantité de mémoire. L’interface conserve les unités de chaque ligne ; elle ne somme pas les durées, les compteurs ou les mesures répétées. Dans le fichier fourni, les mesures répétées ne précisent pas le data center concerné : aucun DC n’est déduit de leur ordre.

Importer un futur CSV avec « Importer un log CSV ». Une erreur de format laisse les dernières données valides affichées. Le bouton de retour recharge la démonstration.

Pour régénérer le fichier de démonstration et sa copie intégrée au HTML :

```sh
python3 poc-visualisation/generate_students_logs.py
```

Les données intégrées permettent l’ouverture directe du HTML sans serveur. Après une modification manuelle du CSV, utiliser l’import pour le consulter.

Les logs ne contiennent ni scores PageRank individuels ni topologie. Leur sélection ne change donc pas le graphe. La section « Simulation PageRank en clair » existante reste un calcul local illustratif, indépendant des mesures importées.

## Fond cartographique

Le graphe est superposé à une carte MapLibre GL JS via le module officiel `@sigma/layer-maplibre` (adaptation locale dans `vendor/`). Les continents ont des couleurs différentes. Le fond utilise les tuiles vectorielles de démonstration MapLibre ; une connexion Internet est nécessaire au chargement des bibliothèques et de la carte.

Les positions sont illustratives : DC1 autour de Denver (Amérique du Nord), DC2 autour de Brasília (Amérique du Sud), DC3 autour de Chengdu (Asie). Pour la liste d’arêtes Students, les nœuds sont distribués de façon stable entre trois DC. Les fichiers contenant une section `[noeuds]` conservent leurs appartenances explicites. Les coordonnées des nœuds sont réparties autour du centre de chaque groupe ; elles ne représentent pas des positions réelles.

La sélection d’un DC affiche uniquement ses nœuds et ses connexions internes ; le Top 10 est filtré de la même manière. Le zoom et le déplacement restent pilotés par Sigma, synchronisé avec le fond de carte. Le bouton de disposition réorganise les nœuds autour de leurs emplacements géographiques.
