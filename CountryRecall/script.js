// ===============================
// Global variables
// ===============================
let clickedCountries = [];
let worldData;

// Track clicked countries per continent
const clickedCountriesByContinent = {
  Europe: new Set(),
  Asia: new Set(),
  Africa: new Set(),
  "North America": new Set(),
  "South America": new Set(),
  Oceania: new Set(),
};

// ===============================
// Initialize MapLibre
// ===============================
const map = new maplibregl.Map({
  container: "map",
  style: "style.json",
  center: [0, 20],
  zoom: 2,
  preserveDrawingBuffer: true, // important!
});

// ===============================
// Initialize Chart.js Charts
// ===============================
const continents = ["Europe", "Asia", "Africa", "North America", "South America", "Oceania"];
const continentCharts = {};

continents.forEach((cont) => {
  const canvas = document.getElementById(`${cont.replace(" ", "")}Chart`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  continentCharts[cont] = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [0, 100],
          backgroundColor: ["#0077ff", "#e0e0e0"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: {
      responsive: false,
      rotation: -90,
      circumference: 360,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
});

// ===============================
// Load Map + Data
// ===============================
map.on("load", async () => {
  // Load GeoJSON once
  try {
    const response = await fetch("world.geojson");
    worldData = await response.json();
  } catch (err) {
    console.error("Failed to load world.geojson:", err);
    return;
  }

  // Add sources and layers
  map.addSource("world-countries", {
    type: "geojson",
    data: worldData,
  });

  map.addLayer({
    id: "world-countries-fill",
    type: "fill",
    source: "world-countries",
    paint: {
      "fill-opacity": 0, // invisible but queryable
    },
  });

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

  // Add source & layer for country labels
  map.addSource("selected-country-labels", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "selected-country-labels",
    type: "symbol",
    source: "selected-country-labels",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold"], 
      "text-size": 12,
      "text-anchor": "center",
    },
    paint: {
      "text-color": "#222",
      "text-halo-color": "#fff",
      "text-halo-width": 2,
    },
  });

  // ===============================
  // Restore from localStorage
  // ===============================
  restoreSavedProgress();

  // Render map + charts with saved data
  if (clickedCountries.length > 0) {
    map.getSource("selected-countries").setData({
      type: "FeatureCollection",
      features: clickedCountries,
    });
    updateLabels();
    Object.keys(clickedCountriesByContinent).forEach(updateContinentChart);
    updateTotalClickedCount();
  }

  // ===============================
  // Input-based country guess
  // ===============================
  const countryInput = document.getElementById("text_a");

  countryInput.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter") return;

    const guess = countryInput.value.trim().toLowerCase();
    if (!guess) return;

    // Find the matching country in worldData (case-insensitive)
    const feature = worldData.features.find((f) => {
  const names = [
    f.properties.name,
    f.properties.admin,
    f.properties.name_en,
    f.properties.name_de
  ].filter(Boolean).map(n => n.trim().toLowerCase());
  
  return names.includes(guess);
});


    if (!feature) {
      // Wrong guess feedback
      countryInput.style.borderColor = "red";
      setTimeout(() => (countryInput.style.borderColor = ""), 1000);
      return;
    }

    const name = feature.properties.name || feature.properties.admin || "Unknown";
    const iso = feature.properties.iso_a3;
    const continent = feature.properties.continent;

    const id = !iso || iso === "-99" ? name : iso;

    // Skip if already guessed
    const alreadyGuessed = clickedCountries.some((f) => {
      const fName = f.properties.name || f.properties.admin || "Unknown";
      const fIso = f.properties.iso_a3;
      const fId = !fIso || fIso === "-99" ? fName : fIso;
      return fId === id;
    });

    if (alreadyGuessed) {
      countryInput.value = "";
      return;
    }

    // ✅ Add country
    clickedCountries.push(feature);
    if (continent && clickedCountriesByContinent[continent]) {
      clickedCountriesByContinent[continent].add(name);
    }

    // Update map layers
    map.getSource("selected-countries").setData({
      type: "FeatureCollection",
      features: clickedCountries,
    });
    updateLabels();

    // Update charts & counters
    if (continent && continentCharts[continent]) updateContinentChart(continent);
    updateTotalClickedCount();

    // Save progress
    saveProgress();

    // Positive feedback
    countryInput.value = "";
    countryInput.style.borderColor = "green";
    setTimeout(() => (countryInput.style.borderColor = ""), 1000);
  });

  // ===============================
  // Hover pointer
  // ===============================
  map.on("mousemove", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["world-countries-fill"] });
    map.getCanvas().style.cursor = features.length ? "pointer" : "";
  });
}); // <-- map.on("load")

// ===============================
// Update Labels Function
// ===============================
function updateLabels() {
  const labelFeatures = clickedCountries.map((f) => {
    const [minLng, minLat, maxLng, maxLat] = turf.bbox(f);
    const center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: center },
      properties: { name: f.properties.name || f.properties.admin || "Unknown" },
    };
  });

  map.getSource("selected-country-labels").setData({
    type: "FeatureCollection",
    features: labelFeatures,
  });
}

// ===============================
// LocalStorage Helpers
// ===============================
function saveProgress() {
  const data = clickedCountries.map((f) => ({
    properties: f.properties,
    geometry: f.geometry,
  }));

  const continentsData = {};
  for (const cont in clickedCountriesByContinent) {
    continentsData[cont] = Array.from(clickedCountriesByContinent[cont]);
  }

  localStorage.setItem("clickedCountries", JSON.stringify(data));
  localStorage.setItem("continentProgress", JSON.stringify(continentsData));
}

function restoreSavedProgress() {
  const savedCountries = localStorage.getItem("clickedCountries");
  const savedContinents = localStorage.getItem("continentProgress");

  if (savedCountries) {
    try {
      const parsed = JSON.parse(savedCountries);
      clickedCountries = parsed.map((f) => ({
        type: "Feature",
        properties: f.properties,
        geometry: f.geometry,
      }));
    } catch (e) {
      console.warn("Failed to parse saved countries:", e);
    }
  }

  if (savedContinents) {
    try {
      const parsed = JSON.parse(savedContinents);
      for (const cont in parsed) {
        clickedCountriesByContinent[cont] = new Set(parsed[cont]);
      }
    } catch (e) {
      console.warn("Failed to parse continent progress:", e);
    }
  }
}

// ===============================
// Chart + Counter Update Helpers
// ===============================
function updateContinentChart(continent) {
  const total =
    worldData.features.filter((f) => f.properties.continent === continent).length || 1;
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
  const totalCountries = worldData ? worldData.features.length : 195;
  const clickedCount = clickedCountries.length;
  const remaining = totalCountries - clickedCount;

  if (totalEl) {
    totalEl.textContent = `${clickedCount} / ${totalCountries}`;
  }

  // Optional: update worldPercent if you still have it
  const percentEl = document.getElementById("worldPercent");
  if (percentEl) {
    const percent = ((clickedCount / totalCountries) * 100).toFixed(1);
    percentEl.textContent = `${percent}%`;
  }
}
