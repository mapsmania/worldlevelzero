let worldData = null;
let clickedEuropeCountries = new Set();
let clickedCountries = []; // store all clicked country features

// Initialize MapLibre
const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [0, 20],
  zoom: 2,
});

// Chart.js setup
const ctx = document.getElementById("europeChart").getContext("2d");
const chartData = {
  datasets: [
    {
      data: [0, 100],
      backgroundColor: ["#0077ff", "#e0e0e0"],
      borderWidth: 0,
      cutout: "75%",
    },
  ],
};
const europeChart = new Chart(ctx, {
  type: "doughnut",
  data: chartData,
  options: {
    responsive: false,
    rotation: -90,
    circumference: 360,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  },
});

// Add empty GeoJSON source on load
map.on("load", async () => {
  map.addSource("selected-countries", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "selected-countries-fill",
    type: "fill",
    source: "selected-countries",
    paint: { "fill-color": "#ff6600", "fill-opacity": 0.5 },
  });

  map.addLayer({
    id: "selected-countries-outline",
    type: "line",
    source: "selected-countries",
    paint: { "line-color": "#cc5200", "line-width": 2 },
  });

  // Load GeoJSON once
  try {
    const response = await fetch("world.geojson");
    worldData = await response.json();
  } catch (err) {
    console.error("Failed to load world.geojson:", err);
    return;
  }

  // On map click
  map.on("click", (e) => {
    if (!worldData) return;
    const clickedCountry = findCountryAtPoint(worldData, e.lngLat);
    if (!clickedCountry) return;

    const props = clickedCountry.properties;
    const name = props.name || props.admin || "Unknown";

    // Only add the country if not already clicked
    const alreadyClicked = clickedCountries.some(
      (f) => f.properties.name === props.name
    );

    if (!alreadyClicked) {
      clickedCountries.push(clickedCountry);

      // Update GeoJSON source with all clicked countries
      map.getSource("selected-countries").setData({
        type: "FeatureCollection",
        features: clickedCountries,
      });

      // Popup
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<strong>${name}</strong>`)
        .addTo(map);

      // Update chart if it's a European country
      if (props.continent === "Europe") {
        clickedEuropeCountries.add(name);
        updateEuropeChart();
      }
    }
  });
});

// Helper: check if a point is inside a polygon (all rings, handles holes)
function pointInPolygon(polygon, [x, y]) {
  let inside = false;

  for (const ring of polygon) {
    let ringInside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) ringInside = !ringInside;
    }
    // outer ring toggles inside status
    if (ringInside) inside = !inside;
  }

  return inside;
}

// Main function to find the country at a given point
function findCountryAtPoint(geojson, point) {
  for (const feature of geojson.features) {
    const geom = feature.geometry;

    if (geom.type === "Polygon") {
      if (pointInPolygon(geom.coordinates, [point.lng, point.lat])) {
        return feature;
      }
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(poly, [point.lng, point.lat])) {
          return feature;
        }
      }
    }
  }

  return null;
}

// Update the radial chart
function updateEuropeChart() {
  const totalEurope = worldData.features.filter(
    (f) => f.properties.continent === "Europe"
  ).length;

  const clickedCount = clickedEuropeCountries.size;
  const percent = Math.round((clickedCount / totalEurope) * 100);

  chartData.datasets[0].data = [percent, 100 - percent];
  europeChart.update();

  document.getElementById("chart-label").innerText = `${percent}%`;
}
