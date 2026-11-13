/* @sigma/layer-maplibre 3.0.0 — MIT; see LICENSE-sigma.txt.
   Official ESM distribution wrapped for script-tag / file:// use. */
(function () {
const { MercatorCoordinate, LngLatBounds, Map, LngLat } = window.maplibregl;

function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}

function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}

function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}

/**
 * Given a geo point returns its graph coords.
 */
function latlngToGraph(map, coord) {
  var data = MercatorCoordinate.fromLngLat(coord);
  return {
    x: data.x,
    // Y are reversed between geo / sigma
    y: map.getContainer().clientHeight - data.y
  };
}

/**
 * Given a graph coords returns its lat/lng coords.
 */
function graphToLatlng(map, coords) {
  var mcoords = new MercatorCoordinate(coords.x, map.getContainer().clientHeight - coords.y, 0);
  var data = mcoords.toLngLat();
  return {
    lat: data.lat,
    lng: data.lng
  };
}

/**
 * BBOX sync : map to sigma
 */
function syncSigmaWithMap(sigma, map) {
  // Compute sigma center
  var center = sigma.viewportToFramedGraph(sigma.graphToViewport(latlngToGraph(map, map.getCenter())));

  // Compute sigma ratio
  var mapBound = map.getBounds();
  var northEast = sigma.graphToViewport(latlngToGraph(map, mapBound.getNorthEast()));
  var southWest = sigma.graphToViewport(latlngToGraph(map, mapBound.getSouthWest()));
  var viewportBoundDimension = {
    width: Math.abs(northEast.x - southWest.x),
    height: Math.abs(northEast.y - southWest.y)
  };
  var viewportDim = sigma.getDimensions();
  var ratio = Math.min(viewportBoundDimension.width / viewportDim.width, viewportBoundDimension.height / viewportDim.height) * sigma.getCamera().getState().ratio;
  sigma.getCamera().setState(_objectSpread2(_objectSpread2({}, center), {}, {
    ratio: ratio
  }));
}

/**
 * BBOX sync : sigma to map
 */
function syncMapWithSigma(sigma, map) {
  var viewportDimensions = sigma.getDimensions();

  // Graph BBox
  var graphBottomLeft = sigma.viewportToGraph({
    x: 0,
    y: viewportDimensions.height
  }, {
    padding: 0
  });
  var graphTopRight = sigma.viewportToGraph({
    x: viewportDimensions.width,
    y: 0
  }, {
    padding: 0
  });

  // Geo BBox
  var geoSouthWest = graphToLatlng(map, graphBottomLeft);
  var geoNorthEast = graphToLatlng(map, graphTopRight);

  // Set map BBox
  var bounds = new LngLatBounds([geoSouthWest, geoNorthEast]);
  map.fitBounds(bounds, {
    duration: 0
  });
}

/**
 * On the graph, we store the 2D projection of the geographical lat/long.
 *
 * @param sigma The sigma instance
 * @param opts.mapOptions Options that will be provided to map constructor.
 * @param opts.getNodeLatLng Function to retrieve lat/long values from a node's attributs (default is lat & lng)
 */
function bindMaplibreLayer(sigma, opts) {
  // Keeping data for the cleanup
  var isKilled = false;
  var prevSigmaSettings = sigma.getSettings();

  // Creating map container
  var mapLayerName = "layer-maplibre";
  var mapContainer = sigma.createLayer(mapLayerName, "div", {
    style: {
      position: "absolute",
      inset: "0"
    },
    // 'edges' is the first sigma layer
    beforeLayer: "edges"
  });
  sigma.getContainer().prepend(mapContainer);

  // Initialize the map
  var map = new Map(_objectSpread2({
    container: mapContainer,
    style: "https://demotiles.maplibre.org/style.json",
    center: [0, 0],
    zoom: 1,
    minPitch: 0,
    maxPitch: 0
  }, (opts === null || opts === void 0 ? void 0 : opts.mapOptions) || {}));

  // `stagePadding: 0` is mandatory, so the bbox of the map & Sigma is the same.
  sigma.setSetting("stagePadding", 0);

  // disable camera rotation
  sigma.setSetting("enableCameraRotation", false);

  // Function that change the given graph by generating the sigma x,y coords by taking the geo coordinates
  // and project them in the 2D space of the map
  function updateGraphCoordinates(graph) {
    graph.updateEachNodeAttributes(function (_node, attrs) {
      var coords = latlngToGraph(map, opts !== null && opts !== void 0 && opts.getNodeLatLng ? opts.getNodeLatLng(attrs) : {
        lat: attrs.lat,
        lng: attrs.lng
      });
      return _objectSpread2(_objectSpread2({}, attrs), {}, {
        x: coords.x,
        y: coords.y
      });
    });
  }

  // Function that sync the map with sigma
  function fnSyncMapWithSigma() {
    syncMapWithSigma(sigma, map);
  }

  // Function that sync sigma with map if it's needed
  function fnSyncSigmaWithMap() {
    if (!sigma.getCamera().isAnimated() && !map.isMoving()) {
      // Check that sigma & map are already in sync
      var southWest = graphToLatlng(map, sigma.viewportToGraph({
        x: 0,
        y: sigma.getDimensions().height
      }));
      var northEast = graphToLatlng(map, sigma.viewportToGraph({
        x: sigma.getDimensions().width,
        y: 0
      }));
      var diff = Math.max(map.getBounds().getSouthWest().distanceTo(new LngLat(southWest.lng, southWest.lat)), map.getBounds().getNorthEast().distanceTo(new LngLat(northEast.lng, northEast.lat)));
      if (diff > 1) {
        syncSigmaWithMap(sigma, map);
      }
    }
  }

  // When sigma is resize, we need to update the graph coordinate (the ref has changed)
  // and recompute the zoom bounds
  function fnOnResize() {
    // Avoid sync map with sigma while we do the resize
    // otherwise there is a sideeffect...
    sigma.off("afterRender", fnSyncMapWithSigma);
    var center = map.getCenter();

    // Ask the map to resize
    map.once("resize", function () {
      // NB: resize can change the center of the map, and we want to keep it
      map.setCenter(center);

      // Map ref has changed, we need to update the graph coordinates
      updateGraphCoordinates(sigma.getGraph());
      // Refresh normalization after the height-dependent Mercator coordinates change.
      // Sigma 3.0.2 otherwise uses the previous bounding box during synchronization.
      sigma.refresh();

      // Do the sync
      fnSyncSigmaWithMap();

      // Re-enable the map sync with sigma in the next frame
      setTimeout(function () {
        fnSyncMapWithSigma();
        sigma.on("afterRender", fnSyncMapWithSigma);
      }, 0);
    });
    map.resize();
  }

  // Clean up function to remove everything
  function clean() {
    if (!isKilled) {
      isKilled = true;
      map.off("moveend", fnSyncSigmaWithMap);
      map.remove();
      sigma.killLayer(mapLayerName);
      sigma.off("afterRender", fnSyncMapWithSigma);
      sigma.off("resize", fnOnResize);

      // Reset settings
      sigma.setSetting("stagePadding", prevSigmaSettings.stagePadding);
      sigma.setSetting("enableCameraRotation", prevSigmaSettings.enableCameraRotation);
    }
  }

  // Update the sigma graph for geospatial coords
  updateGraphCoordinates(sigma.getGraph());

  // When the map is ready
  map.once("load", function () {
    // Compute sigma ratio bounds
    // /!\ must be done after the first map render
    map.once("moveend", function () {
      fnSyncSigmaWithMap();
    });
    // Do the first sync
    fnSyncMapWithSigma();

    // At each render of sigma, we do the map sync
    sigma.on("afterRender", fnSyncMapWithSigma);
    // Listen on resize
    sigma.on("resize", fnOnResize);
    // Do the cleanup
    sigma.on("kill", clean);
    // Keep sigma camera on the map
    map.on("moveend", fnSyncSigmaWithMap);
  });
  return {
    clean: clean,
    map: map,
    updateGraphCoordinates: updateGraphCoordinates
  };
}

window.SigmaMaplibre = { bindMaplibreLayer, graphToLatlng, latlngToGraph };

})();
