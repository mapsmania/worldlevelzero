// Track clicked countries per continent
let clickedCountriesByContinent = {
  Europe: new Set(),
  Asia: new Set(),
  Africa: new Set(),
  "North America": new Set(),
  "South America": new Set(),
  Oceania: new Set(),
};

// Initialize MapLibre
const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [0, 20],
  zoom: 2,
});

// Define continents
const continents = ["Europe", "Asia", "Africa", "North America", "South America", "Oceania"];
const continentCharts = {};

// Initialize Chart.js charts per continent
continents.forEach(cont => {
  const ctx = document.getElementById(`${cont.replace(" ", "")}Chart`).getContext("2d");
  continentCharts[cont] = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: ["#0077ff", "#e0e0e0"],
        borderWidth: 0,
        cutout: "75%",
      }],
    },
    options: {
      responsive: false,
      rotation: -90,
      circumference: 360,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
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
  const continent = props.continent;

  // Check if the country is already selected
  const existingIndex = clickedCountries.findIndex(
    (f) => f.properties.name === name
  );

  if (existingIndex >= 0) {
    // ✅ Country already selected → remove it
    clickedCountries.splice(existingIndex, 1);

    // Remove from continent set
    if (continent && clickedCountriesByContinent[continent]) {
      clickedCountriesByContinent[continent].delete(name);
      updateContinentChart(continent);
    }

    // Update map source
    map.getSource("selected-countries").setData({
      type: "FeatureCollection",
      features: clickedCountries,
    });

    // Update totals
    updateTotalClickedCount();

  } else {
    // ✅ Country not yet selected → add it
    clickedCountries.push(clickedCountry);

    // Add to continent set
    if (continent && clickedCountriesByContinent[continent]) {
      clickedCountriesByContinent[continent].add(name);
      updateContinentChart(continent);
    }

    // Update map source
    map.getSource("selected-countries").setData({
      type: "FeatureCollection",
      features: clickedCountries,
    });

    // Update totals
    updateTotalClickedCount();
  }
});

});

// Cursor pointer on hover
map.on("mousemove", (e) => {
  if (!worldData) return;
  const hoveredCountry = findCountryAtPoint(worldData, e.lngLat);
  map.getCanvas().style.cursor = hoveredCountry ? "pointer" : "";
});

// Helper: check if a point is inside a polygon (handles holes)
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
    if (ringInside) inside = !inside;
  }
  return inside;
}

// Main function to find the country at a given point
function findCountryAtPoint(geojson, point) {
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      if (pointInPolygon(geom.coordinates, [point.lng, point.lat])) return feature;
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(poly, [point.lng, point.lat])) return feature;
      }
    }
  }
  return null;
}

function updateContinentChart(continent) {
  const total = worldData.features.filter(f => f.properties.continent === continent).length;
  const clickedCount = clickedCountriesByContinent[continent].size;
  const percent = Math.round((clickedCount / total) * 100);

  const chart = continentCharts[continent];
  chart.data.datasets[0].data = [percent, 100 - percent];
  chart.update();

  const labelEl = document.getElementById(`${continent.replace(" ", "")}ChartLabel`);
  if (labelEl) labelEl.innerText = `${percent}%`;
}

function updateTotalClickedCount() {
  const totalEl = document.getElementById("totalClicked");
  const percentEl = document.getElementById("worldPercent");
  const totalCountries = worldData ? worldData.features.length : 195;

  if (totalEl) totalEl.textContent = clickedCountries.length;
  if (percentEl) {
    const percent = ((clickedCountries.length / totalCountries) * 100).toFixed(1);
    percentEl.textContent = `${percent}%`;
  }
}
