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
  preserveDrawingBuffer: true  // important!
});

// ===============================
// Initialize Chart.js Charts
// ===============================
const continents = ["Europe", "Asia", "Africa", "North America", "South America", "Oceania"];
const continentCharts = {};

continents.forEach(cont => {
  const canvas = document.getElementById(`${cont.replace(" ", "")}Chart`);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
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

// ===============================
// Load Map + Data
// ===============================
map.on("load", async () => {
  // screencapture button event
  const shareButton = document.getElementById('shareMapBtn');
  if (shareButton) {
  shareButton.addEventListener('click', generateShareableImage);
  }

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
  const feature = worldData.features.find(f => {
    const name = (f.properties.name || f.properties.admin || "").trim().toLowerCase();
    return name === guess;
  });

  if (!feature) {
    // Optional: visual feedback for wrong guess
    countryInput.style.borderColor = "red";
    setTimeout(() => countryInput.style.borderColor = "", 1000);
    return;
  }

  const name = feature.properties.name || feature.properties.admin || "Unknown";
  const iso = feature.properties.iso_a3;
  const continent = feature.properties.continent;

  // Determine safe ID (fallback to name if iso_a3 is missing or "-99")
  const id = (!iso || iso === "-99") ? name : iso;

  // Skip if already guessed
  const alreadyGuessed = clickedCountries.some(f => {
    const fName = f.properties.name || f.properties.admin || "Unknown";
    const fIso = f.properties.iso_a3;
    const fId = (!fIso || fIso === "-99") ? fName : fIso;
    return fId === id;
  });

  if (alreadyGuessed) {
    countryInput.value = ""; // clear input
    return;
  }

  // ✅ Add country to clickedCountries
  clickedCountries.push(feature);
  if (continent && clickedCountriesByContinent[continent]) {
    clickedCountriesByContinent[continent].add(name);
  }

  // Update map layer
  map.getSource("selected-countries").setData({
    type: "FeatureCollection",
    features: clickedCountries,
  });

  // Update charts and counters
  if (continent && continentCharts[continent]) updateContinentChart(continent);
  updateTotalClickedCount();

  // Save progress
  saveProgress();

  // Clear input and provide positive visual feedback
  countryInput.value = "";
  countryInput.style.borderColor = "green";
  setTimeout(() => countryInput.style.borderColor = "", 1000);
});


  // ===============================
  // Handle map clicks
  // ===============================
  map.on("click", (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ["world-countries-fill"] });
  if (!features.length) return;

  const clickedCountry = features[0];
  const props = clickedCountry.properties;
  const name = props.name || props.admin || "Unknown";
  const id = props.iso_a3 || name;
  const continent = props.continent;

  // Skip if already guessed correctly
  const alreadyGuessed = clickedCountries.some(
    (f) => (f.properties.iso_a3 || f.properties.name) === id
  );
  if (alreadyGuessed) return;

  // Create popup container
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px; font-family:sans-serif; width:180px;">
      <label style="font-size:14px; font-weight:bold;">Guess this country:</label>
      <input id="countryGuessInput" type="text" placeholder="Type name..." 
             style="padding:4px; border:1px solid #ccc; border-radius:4px; width:100%;">
      <button id="submitGuessBtn" style="padding:4px 6px; background:#0077ff; color:white; border:none; border-radius:4px; cursor:pointer;">Submit</button>
      <div id="guessFeedback" style="font-size:13px; color:red; display:none;"></div>
    </div>
  `;

  const popup = new maplibregl.Popup({ closeOnClick: true })
    .setLngLat(e.lngLat)
    .setDOMContent(popupDiv)
    .addTo(map);

  const input = popupDiv.querySelector("#countryGuessInput");
  const button = popupDiv.querySelector("#submitGuessBtn");
  const feedback = popupDiv.querySelector("#guessFeedback");

  // Focus input when popup opens
  setTimeout(() => input.focus(), 100);

  button.addEventListener("click", () => {
    const guess = input.value.trim().toLowerCase();
    const correct = name.trim().toLowerCase();

    if (guess === correct) {
      // ✅ Correct answer!
      clickedCountries.push(clickedCountry);
      if (continent && clickedCountriesByContinent[continent]) {
        clickedCountriesByContinent[continent].add(name);
      }

      // Update visuals
      if (continent && continentCharts[continent]) updateContinentChart(continent);
      updateTotalClickedCount();

      map.getSource("selected-countries").setData({
        type: "FeatureCollection",
        features: clickedCountries,
      });

      saveProgress();

      feedback.style.color = "green";
      feedback.textContent = "✅ Correct!";
      feedback.style.display = "block";

      // Auto-close popup after 1s
      setTimeout(() => popup.remove(), 1000);
    } else {
      // ❌ Wrong guess
      feedback.style.display = "block";
      feedback.textContent = "❌ Try again!";
      feedback.style.color = "red";
    }
  });

  // Allow pressing Enter
  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") button.click();
  });
});

  // ===============================
  // Hover pointer
  // ===============================
  map.on("mousemove", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["world-countries-fill"] });
    map.getCanvas().style.cursor = features.length ? "pointer" : "";
  });
});

// ===============================
// LocalStorage Helpers
// ===============================
function saveProgress() {
  // Save clicked countries (store only minimal props + geometry)
  const data = clickedCountries.map(f => ({
    properties: f.properties,
    geometry: f.geometry,
  }));

  // Save continent progress as arrays
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
      clickedCountries = parsed.map(f => ({
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
  const total = worldData.features.filter(f => f.properties.continent === continent).length || 1;
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

