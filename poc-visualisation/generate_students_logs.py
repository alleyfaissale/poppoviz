"""Generate illustrative performance logs, NOT measurements from POPPY.

Run: python3 poc-visualisation/generate_students_logs.py
Also refreshes the HTML's embedded copy for direct file opening.
"""
import csv
import io
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
edges = {tuple(line.split()) for line in (ROOT / 'students.txt').read_text().splitlines() if line.strip()}
nodes = {node for edge in edges for node in edge}
output = io.StringIO(newline='')
writer = csv.writer(output, lineterminator='\n')
writer.writerow(['multDepth', 'batchSize', 'ringsize', 'title', 'operation', 'unit', 'time', 'run'])

def row(title, operation, unit, value, iteration):
    writer.writerow([25, 8192, 131072, title, operation, unit, value, iteration])

row('DEMO SYNTHETIQUE - Number of nodes', 'GRAPH_NODES', 'UNIT', len(nodes), 0)
row('DEMO SYNTHETIQUE - Number of edges', 'GRAPH_EDGES', 'UNIT', len(edges), 0)
for iteration in range(1, 11):
    # Arbitrary deterministic values for exercising the log viewer only.
    for title, operation, unit, value in [
        ('Time to synchronize distant PRs', 'SYNC', 'MILLISECONDS', 120 + 3 * iteration),
        ('Time to compute one iteration', 'EVAL_OP', 'MILLISECONDS', 45 + iteration),
        ('Time to prepare next iteration', 'PREP', 'MILLISECONDS', 0 if iteration == 10 else 80 + 2 * iteration),
        ('Number of addition during computation', 'ADD_COMPUTE', 'UNIT', len(edges)),
        ('Number of multiplication scalar during computation', 'MUL_SCALAR_COMPUTE', 'UNIT', len(nodes)),
        ('Number of rotation during preparation', 'ROT_PREP', 'UNIT', 0 if iteration == 10 else len(edges)),
        ('Number of received ciphertext during synchronization', 'CIPHER_SYNC', 'UNIT', 6),
        ('Memory usage', 'MEMORY', 'MB', 512 + 4 * iteration),
        ('Peak memory usage', 'MEMORY_PEAK', 'MB', 600 + 4 * iteration),
    ]:
        row('DEMO SYNTHETIQUE - ' + title, operation, unit, value, iteration)
text = output.getvalue()
(ROOT / 'expe_poppy_uj-students-demo.csv').write_text(text)
page = ROOT / 'poppyviz-students.html'
html = page.read_text()
block = '<script type="text/plain" id="default-logs">' + text + '</script>'
if 'id="default-logs"' in html:
    html = re.sub(r'<script type="text/plain" id="default-logs">.*?</script>', lambda _: block, html, count=1, flags=re.S)
else:
    html = html.replace('<script src=', block + '\n<script src=', 1)
page.write_text(html)
print('Generated expe_poppy_uj-students-demo.csv (synthetic) and updated embedded logs.')
