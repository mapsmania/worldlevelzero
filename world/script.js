// Initialize the map
const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [0, 20],
  zoom: 2,
});

// Prepare a source for a single selected country (empty at start)
map.on("load", async () => {
  map.addSource("selected-country", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  // Add layer to visualize selected polygon
  map.addLayer({
    id: "selected-country-fill",
    type: "fill",
    source: "selected-country",
    paint: {
      "fill-color": "#ff6600",
      "fill-opacity": 0.5,
    },
  });

  map.addLayer({
    id: "selected-country-outline",
    type: "line",
    source: "selected-country",
    paint: {
      "line-color": "#cc5200",
      "line-width": 2,
    },
  });

  // Handle click events
  map.on("click", async (e) => {
    try {
      const response = await fetch("world.geojson");
      if (!response.ok) throw new Error("Failed to load GeoJSON");
      const worldData = await response.json();

      // Check which country polygon contains the clicked point
      const clickedCountry = findCountryAtPoint(worldData, e.lngLat);

      if (clickedCountry) {
        // Update the source with just this country's polygon
        map.getSource("selected-country").setData({
          type: "FeatureCollection",
          features: [clickedCountry],
        });

        // Show popup with country name
        const props = clickedCountry.properties;
        const name = props.name || props.admin || "Unknown";
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${name}</strong>`)
          .addTo(map);
      } else {
        console.log("No country found at this location.");
      }
    } catch (err) {
      console.error("Error loading or parsing GeoJSON:", err);
    }
  });
});

/**
 * Helper function: find which country polygon contains a point
 * @param {Object} geojson - GeoJSON FeatureCollection
 * @param {Object} point - { lng, lat } object
 * @returns {Object|null} - The country feature that contains the point, or null
 */
function findCountryAtPoint(geojson, point) {
  // Simple point-in-polygon check using ray-casting
  function pointInPolygon(polygon, [x, y]) {
    let inside = false;
    const coords = polygon[0];
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0],
        yi = coords[i][1];
      const xj = coords[j][0],
        yj = coords[j][1];
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  for (const feature of geojson.features) {
    if (feature.geometry.type === "Polygon") {
      if (pointInPolygon(feature.geometry.coordinates, [point.lng, point.lat])) {
        return feature;
      }
    } else if (feature.geometry.type === "MultiPolygon") {
      for (const poly of feature.geometry.coordinates) {
        if (pointInPolygon(poly, [point.lng, point.lat])) {
          return feature;
        }
      }
    }
  }
  return null;
}
