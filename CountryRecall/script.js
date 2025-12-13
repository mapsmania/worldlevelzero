// ===============================
// Global variables
// ===============================
let clickedCountries = [];
let worldData;
let labelPointsData = null;

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
  preserveDrawingBuffer: true,
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
          backgroundColor: ["#ff6600", "#e0e0e0"], // orange = completed
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
  try {
    // Load both world polygons and precomputed label points
    const [worldResp, labelResp] = await Promise.all([
      fetch("country.geojson"),
      fetch("labelpoint.geojson")
    ]);
    worldData = await worldResp.json();
    labelPointsData = await labelResp.json();
  } catch (err) {
    console.error("Failed to load required GeoJSON files:", err);
    return;
  }

  // Add world country polygons
  map.addSource("world-countries", { type: "geojson", data: worldData });
  map.addLayer({
    id: "world-countries-fill",
    type: "fill",
    source: "world-countries",
    paint: { "fill-opacity": 0 },
  });

  // Add selected countries layer
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

  // Add labels layer
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
  // Restore saved progress
  // ===============================
  restoreSavedProgress();

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
  // Input for naming countries
  // ===============================
  const countryInput = document.getElementById("text_a");

  countryInput.addEventListener("keydown", (evt) => {
    if (evt.key !== "Enter") return;

    const guess = countryInput.value.trim().toLowerCase();
    if (!guess) return;

    // Find matching country (case-insensitive)
    const feature = worldData.features.find((f) => {
      const names = [
        f.properties.name,
        f.properties.admin,
        f.properties.name_en,
        f.properties.name_de,
      ]
        .filter(Boolean)
        .map((n) => n.trim().toLowerCase());
      return names.includes(guess);
    });

    if (!feature) {
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

    // Add new country
    clickedCountries.push(feature);
    if (continent && clickedCountriesByContinent[continent]) {
      clickedCountriesByContinent[continent].add(name);
    }

    map.getSource("selected-countries").setData({
      type: "FeatureCollection",
      features: clickedCountries,
    });
    updateLabels();

    if (continent && continentCharts[continent]) updateContinentChart(continent);
    updateTotalClickedCount();
    saveProgress();

    // Green feedback
    countryInput.value = "";
    countryInput.style.borderColor = "green";
    setTimeout(() => (countryInput.style.borderColor = ""), 1000);
  });

  // Pointer on hover
  map.on("mousemove", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["world-countries-fill"] });
    map.getCanvas().style.cursor = features.length ? "pointer" : "";
  });
});

// ===============================
// Fast label placement
// ===============================
function updateLabels() {
  if (!labelPointsData) return;

  const labelFeatures = clickedCountries.map((f) => {
    const name = f.properties.name || f.properties.admin;
    const labelFeature = labelPointsData.features.find(
      (lp) => lp.properties.name === name
    );

    const coords = labelFeature
      ? labelFeature.geometry.coordinates
      : turf.centroid(f).geometry.coordinates;

    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: { name },
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
// Charts + Counter
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

  if (totalEl) {
    totalEl.textContent = `${clickedCount} / ${totalCountries}`;
  }

  const percentEl = document.getElementById("worldPercent");
  if (percentEl) {
    const percent = ((clickedCount / totalCountries) * 100).toFixed(1);
    percentEl.textContent = `${percent}%`;
  }
}

// ===============================
// Reset Button with Custom Modal
// ===============================
const resetButton = document.getElementById("reset-button");
const resetModal = document.getElementById("reset-confirmation");
const confirmReset = document.getElementById("confirm-reset");
const cancelReset = document.getElementById("cancel-reset");

resetButton.addEventListener("click", () => {
  resetModal.classList.remove("hidden"); // Show modal
});

cancelReset.addEventListener("click", () => {
  resetModal.classList.add("hidden"); // Hide modal
});

confirmReset.addEventListener("click", () => {
  // Hide modal
  resetModal.classList.add("hidden");

  // Clear local storage
  localStorage.removeItem("clickedCountries");
  localStorage.removeItem("continentProgress");

  // Clear in-memory data
  clickedCountries = [];
  for (const cont in clickedCountriesByContinent) {
    clickedCountriesByContinent[cont].clear();
  }

  // Reset charts
  continents.forEach((cont) => {
    const chart = continentCharts[cont];
    if (chart) {
      chart.data.datasets[0].data = [0, 100];
      chart.update();
      const labelEl = document.getElementById(`${cont.replace(" ", "")}ChartLabel`);
      if (labelEl) labelEl.textContent = "0%";
    }
  });

  // Reset counters
  const totalEl = document.getElementById("totalClicked");
  const percentEl = document.getElementById("worldPercent");
  const totalCountries = worldData ? worldData.features.length : 195;
  if (totalEl) totalEl.textContent = `0 / ${totalCountries}`;
  if (percentEl) percentEl.textContent = "0%";

  // Clear map layers
  map.getSource("selected-countries").setData({
    type: "FeatureCollection",
    features: [],
  });
  map.getSource("selected-country-labels").setData({
    type: "FeatureCollection",
    features: [],
  });
});
