# Sigma–MapLibre adapter

`sigma-layer-maplibre-3.0.0.js` is the official `@sigma/layer-maplibre@3.0.0` ESM distribution:
https://cdn.jsdelivr.net/npm/@sigma/layer-maplibre@3.0.0/dist/sigma-layer-maplibre.esm.js

MIT license: see `LICENSE-sigma.txt`.

Local adaptations:

- Wrapped in an IIFE, with the `maplibre-gl` import taken from `window.maplibregl` and exports exposed as `window.SigmaMaplibre`. This keeps the existing script-tag interface and direct `file://` opening without a bundler.
- Refresh Sigma immediately after updating height-dependent coordinates during resize, so its normalization matches the new graph coordinates before camera synchronization.

Runtime dependencies: Sigma 3.0.2 and MapLibre GL JS 4.7.1, loaded by the HTML from jsDelivr.
