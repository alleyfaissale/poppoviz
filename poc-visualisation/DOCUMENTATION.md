# Maintenance du PoC

## Organisation

| Fichier | Responsabilité |
|---|---|
| `poppyviz-students.html` | Structure de l'interface, graphe DOT et paires PageRank intégrés |
| `assets/styles.css` | Thèmes clair/sombre, disposition, popups et histogramme modal |
| `assets/logs-core.js` | Parseur CSV, enrichissement et agrégation sans accès au DOM |
| `assets/app.js` | Lecture des graphes, simulation, carte, événements et rendu des panneaux |
| `vendor/` | Adaptation Sigma–MapLibre et sa licence MIT |
| `data/err-poppy_uj-p2p-Gnutella04-partition4.dot-1.txt` | Fichier contenant la repartion en dc du graphe de gnutella |
| `scripts/integrer_resultats.py` | Conversion reproductible du TXT en données embarquées |
| `scripts/integrer_graphe.py` | Remplacement du graphe embarqué |
| `scripts/enrichir_logs_poppy.py` | Équivalent Python de l'enrichissement des logs, avec pandas |
| `serve.py` | Serveur HTTP local pour démonstration |
| `tests/` | Contrôles des ressources, des données et des traitements JavaScript |

Les bibliothèques distantes sont versionnées dans les balises du HTML : Graphology 0.26.0, Sigma 3.0.2, Chart.js 4.4.1, MapLibre GL 4.7.1. Les polices Google et les tuiles de démonstration restent distantes. Aucune compilation n'est nécessaire. Le code charge `logs-core.js` avant `app.js`, après les bibliothèques. Il utilise volontairement des scripts classiques pour conserver l'ouverture par `file://`.

## Cycle de l'application

`load()` lit le graphe, assigne les attributs inter-DC, calcule `pagerankHistory()`, prépare la disposition et initialise Sigma. `state` conserve le graphe, la vue, le nœud sélectionné et l'itération de simulation. `refreshPanels()` actualise les statistiques et le classement. La simulation utilise un amortissement de 0,85, un maximum de 100 itérations et une tolérance de 1e-8 ; ce calcul est illustratif et ne garantit pas la convention utilisée dans l'article.

`loadLogs()` valide tout le CSV avant de remplacer les données actives. `parseLogCSV()` accepte BOM, guillemets doublés et champs multilignes ; les huit colonnes attendues sont requises, avec des valeurs numériques finies et un run entier positif ou nul. `enrichLogs()` déduit les DC et les étapes, puis convertit les unités de temps en millisecondes. `aggregateLogs()` regroupe par itération/DC/étape, additionne les opérations et calcule le cumul des CIPHER_SYNC.

`renderLogs()` sert le panneau de droite et le popup du DC. `histogramData()` ne retient que le DC courant et les itérations > 0 ; les temps sont convertis en secondes pour Chart.js. Une valeur nulle n'est pas un zéro. Le total est la somme des étapes disponibles et n'inclut pas les lignes globales FINAL.

`refreshReferenceRanking()` classe les valeurs de référence et affiche le score Poppy correspondant pour les mêmes nœuds. Les données sont des triplets `[identifiant, référence, poppy]`, avec `null` pour une valeur invalide. Ce classement ne suit pas le curseur de simulation. La vérification actuelle exige le même contenu textuel que le graphe intégré, pas seulement le même nombre de nœuds.

Le dialogue natif de l'histogramme utilise `showModal()` pour apparaître dans la couche supérieure du navigateur et conserver le focus dans la fenêtre. `closeDCHist()` et `closeDCLogs()` assurent l'exclusion mutuelle. La largeur du canevas suit la fenêtre, sans largeur minimale imposée par le nombre d'itérations.

