"""Intègre les paires PageRank client ; les nombres mal formés deviennent null.

Les identifiants sont conservés tels quels, sans correction ni normalisation.
Usage : python3 poc-visualisation/scripts/integrer_resultats.py fichier.txt
"""
import argparse
import json
import math
import re
from pathlib import Path

PAIR = re.compile(r'Reference Value \((\d+)\)\s*:\s*([^\s]+)\s+Multi DC POPPYuj\s*:\s*([^\s]+)')


def parse_results(text):
    rows, invalid, seen = [], [], set()
    for node, reference, poppy in PAIR.findall(text):
        if node in seen:
            raise ValueError(f'Identifiant dupliqué : {node}')
        seen.add(node)
        values = []
        for field, raw in [('reference', reference), ('poppy', poppy)]:
            try:
                value = float(raw)
                if not math.isfinite(value) or value < 0:
                    raise ValueError()
            except ValueError:
                value = None
                invalid.append((node, field, raw))
            values.append(value)
        rows.append([node, *values])
    if not rows:
        raise ValueError('Aucune paire PageRank trouvée.')
    # Une ligne isolée ne doit pas disparaître silencieusement pendant une mise à jour.
    if len(re.findall(r'^Reference Value', text, re.M)) != len(rows) or len(re.findall(r'^Multi DC POPPYuj', text, re.M)) != len(rows):
        raise ValueError('Paires incomplètes ou format inattendu.')
    return rows, invalid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    rows, invalid = parse_results(args.source.read_text(encoding='utf-8'))
    page = Path(__file__).resolve().parents[1] / 'poppyviz-students.html'
    content, count = re.subn(
        r'(<script type="application/json" id="client-pagerank-results">).*?(</script>)',
        lambda m: m[1] + json.dumps(rows, separators=(',', ':'), allow_nan=False) + m[2],
        page.read_text(encoding='utf-8'), count=1, flags=re.S)
    if count != 1:
        raise ValueError('Bloc client-pagerank-results introuvable.')
    page.write_text(content, encoding='utf-8')
    print(f'{len(rows)} nœuds intégrés ; {len(invalid)} valeurs invalides : {invalid}')


if __name__ == '__main__':
    main()
