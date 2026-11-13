"""Serveur de démonstration local, sans dépendance tierce (Python 3.10+)."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    try:
        with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
            print(f'PoppyViz : http://127.0.0.1:{args.port}/poppyviz-students.html', flush=True)
            print('Arrêter : Ctrl+C. Une connexion Internet est nécessaire pour la carte.', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except OSError as error:
        parser.exit(1, f'Démarrage impossible : {error}. Essayez --port 8001.\n')


if __name__ == '__main__':
    main()
