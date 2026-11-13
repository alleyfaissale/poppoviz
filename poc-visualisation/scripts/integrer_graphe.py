"""Intègre un fichier de graphe dans poppyviz-students.html : c'est le graphe affiché à l'ouverture.

La copie intégrée permet d'ouvrir la page directement (file://), sans serveur.
Formats acceptés par la page : partition POPPY .dot, section [noeuds]/[aretes], liste d'arêtes.

Usage : python3 poc-visualisation/scripts/integrer_graphe.py poc-visualisation/p2p-Gnutella04-partition4.dot
"""
import html
import re
import sys
from pathlib import Path

source = Path(sys.argv[1])
page = Path(__file__).resolve().parent.parent / 'poppyviz-students.html'
texte = source.read_text()
if '</script' in texte.lower():
    sys.exit("Le fichier contient « </script » : intégration impossible.")
bloc = (f'<script type="text/plain" id="default-graph" data-name="{html.escape(source.name)}">'
        + texte + '</script>')
contenu = page.read_text()
contenu, n = re.subn(r'<script type="text/plain" id="default-graph"[^>]*>.*?</script>',
                     lambda _: bloc, contenu, count=1, flags=re.S)
if n != 1:
    sys.exit('Bloc id="default-graph" introuvable dans la page.')
page.write_text(contenu)
print(f"Graphe par défaut : {source.name} ({len(texte) // 1024} Ko)")
