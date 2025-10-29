let worldData = null;
let clickedEuropeCountries = new Set();

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
      data: [0, 100], // filled vs remaining
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

// Add layers on load
map.on("load", async () => {
  map.addSource("selected-country", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "selected-country-fill",
    type: "fill",
    source: "selected-country",
    paint: { "fill-color": "#ff6600", "fill-opacity": 0.5 },
  });

  map.addLayer({
    id: "selected-country-outline",
    type: "line",
    source: "selected-country",
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

    // Draw country
    map.getSource("selected-country").setData({
      type: "FeatureCollection",
      features: [clickedCountry],
    });

    // Popup
    const props = clickedCountry.properties;
    const name = props.name || props.admin || "Unknown";
    new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${name}</strong>`).addTo(map);

    // Check if it's in Europe
    if (props.continent === "Europe") {
      clickedEuropeCountries.add(name);
      updateEuropeChart();
    }
  });
});

// Helper: Point-in-polygon check
function findCountryAtPoint(geojson, point) {
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

// Update the radial chart
function updateEuropeChart() {
  // Count total European countries in dataset
  const totalEurope = worldData.features.filter(
    (f) => f.properties.continent === "Europe"
  ).length;

  const clickedCount = clickedEuropeCountries.size;
  const percent = Math.round((clickedCount / totalEurope) * 100);

  chartData.datasets[0].data = [percent, 100 - percent];
  europeChart.update();

  document.getElementById("chart-label").innerText = `${percent}%`;
}
