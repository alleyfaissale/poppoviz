"""Contrôles reproductibles du livrable, sans dépendances Python tierces."""
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'poppyviz-students.html'
spec = importlib.util.spec_from_file_location('integrer_resultats', ROOT / 'scripts/integrer_resultats.py')
integrator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrator)


class DeliveryTests(unittest.TestCase):
    def test_local_resources_and_unique_ids(self):
        ids, resources = [], []

        class Parser(HTMLParser):
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if 'id' in attrs:
                    ids.append(attrs['id'])
                if tag == 'script' and attrs.get('src'):
                    resources.append(attrs['src'])
                if tag == 'link' and attrs.get('rel') == 'stylesheet':
                    resources.append(attrs['href'])

        Parser().feed(HTML.read_text(encoding='utf-8'))
        self.assertEqual(len(ids), len(set(ids)))
        for resource in resources:
            if not resource.startswith('https://'):
                self.assertTrue((ROOT / resource).is_file(), resource)

    def test_client_source_matches_embedded_results(self):
        source = ROOT / 'data/err-poppy_uj-p2p-Gnutella04-partition4.dot-1.txt'
        rows, invalid = integrator.parse_results(source.read_text(encoding='utf-8'))
        embedded = re.search(r'id="client-pagerank-results">(.*?)</script>', HTML.read_text(encoding='utf-8'), re.S)
        self.assertEqual(rows, json.loads(embedded[1]))
        self.assertEqual(len(rows), 10876)
        self.assertEqual({r[0] for r in rows}, {str(i) for i in range(10876)})
        self.assertEqual(invalid, [('69', 'poppy', '0..00665131'), ('6067', 'reference', '0..00229105')])

    def test_integrator_rejects_incomplete_or_duplicate_pairs(self):
        with self.assertRaises(ValueError):
            integrator.parse_results('Reference Value (1) : 0.1')
        pair = 'Reference Value (1) : 0.1\nMulti DC POPPYuj : 0.2\n'
        with self.assertRaises(ValueError):
            integrator.parse_results(pair + pair)

    def test_embedded_graph_matches_delivered_dot(self):
        embedded = re.search(r'id="default-graph"[^>]*>(.*?)</script>', HTML.read_text(encoding='utf-8'), re.S)
        self.assertEqual(embedded[1].strip(), (ROOT / 'p2p-Gnutella04-partition4.dot').read_text(encoding='utf-8').strip())

    def test_javascript_business_rules(self):
        app = (ROOT / 'assets/app.js').read_text(encoding='utf-8')
        core = (ROOT / 'assets/logs-core.js').read_text(encoding='utf-8')
        # Ces fonctions pures restent celles utilisées par l'interface.
        functions = []
        for name in ['referenceTopScores', 'histogramData']:
            match = re.search(r'function ' + name + r'\([^\n]*\) \{[\s\S]*?\n\}', app)
            self.assertIsNotNone(match)
            functions.append(match[0])
        program = 'new Function(' + json.dumps(app) + ');\n' + core + '\nlet logAgg = [];\n' + '\n'.join(functions)
        program += '\nconst deliveredCSV = ' + json.dumps((ROOT / 'expe_poppy_uj-p2p-Gnutella04-partition4.dot-1.csv').read_text(encoding='utf-8')) + ';\n'
        program += '\n' + (ROOT / 'tests/logic.js').read_text(encoding='utf-8')
        node = shutil.which('node')
        swift = shutil.which('swift') if sys.platform == 'darwin' else None
        if not node and not swift:
            self.fail('Installer Node.js 18+ pour exécuter les tests JavaScript.')
        with tempfile.TemporaryDirectory(prefix='poppyviz-test-') as directory:
            script = Path(directory) / 'tests.js'
            script.write_text(program, encoding='utf-8')
            if node:
                command = [node, str(script)]
            else:
                runner = '''import Foundation
import JavaScriptCore
let c = JSContext()!
c.exceptionHandler = { _, e in print("ERROR: \\(e!)"); exit(1) }
c.evaluateScript("var console = { log: function() {} };")
let s = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
c.evaluateScript(s)
print("JavaScriptCore : assertions OK")
'''
                runner_path = Path(directory) / 'runner.swift'
                runner_path.write_text(runner, encoding='utf-8')
                command = [swift, '-module-cache-path', str(Path(directory) / 'cache'), str(runner_path), str(script)]
            result = subprocess.run(command, text=True, capture_output=True, timeout=120)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
