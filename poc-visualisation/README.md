# Utiliser PoppyViz

## Prérequis et lancement

- Navigateur récent : Firefox, Chrome, Edge ou Safari, avec WebGL activé.
- Internet pour Graphology, Sigma, Chart.js, MapLibre, les polices et les tuiles cartographiques.
- Python 3.10+ pour le serveur et les outils ; aucun paquet Python requis pour l'interface.

Depuis la racine du dépôt :

```sh
python3 poc-visualisation/serve.py
```

Windows : `py -3 poc-visualisation/serve.py`. Ouvrir <http://127.0.0.1:8000/poppyviz-students.html>. Si le port est occupé, ajouter `--port 8001`. Le serveur écoute uniquement sur cet ordinateur ; arrêter avec Ctrl+C. L'ouverture directe du HTML reste possible, avec ses dossiers `assets/` et `vendor/` et une connexion Internet.

Pour transférer le PoC, copier **tout le dossier `poc-visualisation`**. Aucun chemin vers Downloads, aucune installation npm et aucun service applicatif externe ne sont nécessaires. Le chargement de ressources publiques depuis Internet reste nécessaire : ce livrable n'est pas un paquet hors ligne.

## Parcours de démonstration

1. La carte charge le graphe Gnutella intégré : 10 876 nœuds et cinq DC. Les positions géographiques sont illustratives.
2. Cliquer sur l'étiquette d'un DC pour consulter ses statistiques. Le nom du graphe en haut ouvre les statistiques globales.
3. Dans le panneau de droite, importer `expe_poppy_uj-p2p-Gnutella04-partition4.dot-1.csv`. Aucun CSV n'est chargé automatiquement.
4. Dans les statistiques du DC, ouvrir **Logs** : choisir une itération et consulter temps, opérations, chiffrés reçus et cumul. Les lignes brutes sont pliées par défaut.
5. Ouvrir **Histogramme** : une fenêtre modale centrée affiche les étapes et leur total sur les itérations disponibles. Logs et histogramme ne s'ouvrent pas simultanément. Sans CSV, un bouton propose l'import. Fermer avec la croix ou Échap.
6. Le **Top 10 PageRank** utilise les résultats client à l'itération 10, triés par référence décroissante, avec la valeur Poppy en regard. Il suit le DC sélectionné et reste indépendant du curseur de simulation.
7. Cliquer un nœud du classement le sélectionne sur la carte. La taille des nœuds et le score de la fiche utilisent encore la simulation locale, pas les résultats client.

Le fichier `expe_poppy_uj-students-demo.csv` est **synthétique** et destiné uniquement à exercer l'interface. Pour lui associer un graphe, charger `students.txt` ; ses blocs de logs ne décrivent pas les cinq DC de Gnutella.

## Données et limites

- Le CSV ne fournit pas d'identifiant de DC : l'ordre des blocs SYNC détermine DC0, DC1, etc. La correspondance avec les partitions de la carte reste à confirmer avec le client.
- Les étapes présentes sont SYNC, EVAL_OP, BOOTSTRAP et PREP. TOTAL additionne leurs durées mesurées ; une durée manquante reste absente. Il n'y a pas de barres d'incertitude calculées.
- Les résultats TXT donnent un seul état final (itération 10), pas dix états PageRank successifs. Les valeurs ne sont pas renormalisées.
- Deux nombres du TXT sont mal formés : Poppy du nœud 69 et référence du nœud 6067. Ils deviennent absents, sans correction automatique. Le nœud 6067 est exclu du tri de référence.
- Le classement client est réservé au graphe intégré ; charger un autre contenu le masque. Les indices du TXT sont utilisés comme identifiants du graphe ; cette correspondance et la normalisation doivent être validées avec le client.
- La valeur k de l'article n'est pas encore implémentée. Le degré entrant maximal affiché dans les statistiques ne doit pas être présenté comme k.

Les fichiers importés sont traités dans le navigateur, sans serveur d'import ni stockage persistant. Actualiser la page réinitialise les imports. Les CDN et le fournisseur de carte reçoivent les requêtes nécessaires à leurs ressources.

## Dépannage

| Symptôme | Vérification |
|---|---|
| Carte ou contrôles absents | Vérifier Internet, accès à jsDelivr et demotiles.maplibre.org, console du navigateur et WebGL. |
| Page servie introuvable | Utiliser l'URL complète affichée par `serve.py`. |
| Aucun log dans un DC | Vérifier le CSV, l'itération et la correspondance des blocs SYNC avec les partitions. |
| Top 10 absent après import d'un graphe | Les résultats intégrés ne s'appliquent qu'au graphe initial ; recharger la page pour le retrouver. |
| Graphique indisponible | Chart.js peut être bloqué ; les valeurs restent consultables dans le tableau dépliable. |

Voir [README-logs.md](README-logs.md) pour le format CSV et [DOCUMENTATION.md](DOCUMENTATION.md) pour modifier le PoC.
