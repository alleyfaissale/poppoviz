# PoppyViz — PoC de visualisation POPPY

Visualisation d'un graphe partitionné en data centers, de ses statistiques, des logs d'exécution POPPY et des scores PageRank finaux fournis par le client.

Le livrable est dans [`poc-visualisation/`](poc-visualisation/README.md). Il fonctionne sous Windows, macOS et Linux avec un navigateur récent prenant en charge WebGL et une connexion Internet. Il n'exécute pas POPPY : il visualise des fichiers et propose une simulation locale distincte.

## Démarrer

Depuis la racine du dépôt, avec Python 3.10 ou supérieur :

```sh
python3 poc-visualisation/serve.py
```

Ouvrir ensuite <http://127.0.0.1:8000/poppyviz-students.html>. Arrêter avec Ctrl+C.

Sans Python, ouvrir directement `poc-visualisation/poppyviz-students.html` dans le navigateur en conservant tout le dossier à côté du fichier. Internet reste nécessaire pour les bibliothèques et le fond cartographique.

## Tester et maintenir

```sh
python3 -m unittest discover -s poc-visualisation/tests -v
```

Les tests des traitements JavaScript utilisent Node.js (18 ou supérieur). Les tests Python ne nécessitent aucun paquet tiers. Voir le [guide utilisateur](poc-visualisation/README.md), la [documentation technique](poc-visualisation/DOCUMENTATION.md) 

Les dossiers `docs/`, `etat-de-l-art/` et `compte-rendu/` contiennent les documents de travail ; ils ne sont pas nécessaires à l'exécution.
