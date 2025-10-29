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
  style: "https://tiles.openfreemap.org/styles/positron",
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

    const existingIndex = clickedCountries.findIndex(
      (f) => (f.properties.iso_a3 || f.properties.name) === id
    );

    if (existingIndex >= 0) {
      // ✅ Country already selected → remove it
      clickedCountries.splice(existingIndex, 1);
      if (continent && clickedCountriesByContinent[continent]) {
        clickedCountriesByContinent[continent].delete(name);
      }
    } else {
      // ✅ Add new selection
      clickedCountries.push(clickedCountry);
      if (continent && clickedCountriesByContinent[continent]) {
        clickedCountriesByContinent[continent].add(name);
      }
    }

    // Update visuals
    if (continent && continentCharts[continent]) updateContinentChart(continent);
    updateTotalClickedCount();

    // Update map overlay
    map.getSource("selected-countries").setData({
      type: "FeatureCollection",
      features: clickedCountries,
    });

    // 💾 Save to localStorage
    saveProgress();
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

// ===============================
// Share Image Functionality
// ===============================

// New function: Prepare the UI for a clean screenshot
function prepareUIForCapture() {
    // Hide temporary/interactive elements before capture
    const dialog = document.getElementById('shareDialog');
    if (dialog) dialog.style.display = 'none';

    const shareButton = document.getElementById('shareMapBtn');
    if (shareButton) shareButton.style.display = 'none'; // Hide the button itself

    // Note: If you have any other elements you want hidden from the screenshot,
    // like popups or tooltips, hide them here.
}

// New function: Restore the UI after screenshot
function restoreUI() {
    // Restore display of hidden elements
    const dialog = document.getElementById('shareDialog');
    if (dialog) dialog.style.display = 'block';

    const shareButton = document.getElementById('shareMapBtn');
    if (shareButton) shareButton.style.display = 'block'; // Show the button again
}


async function generateShareableImage() {
    const button = document.getElementById('shareMapBtn');
    const originalText = button.innerHTML;

    try {
        // Show loading state
        button.innerHTML = '⏳ Generating...';
        button.disabled = true;

        // 1. Prepare UI for clean capture (e.g., hide the share button itself)
        prepareUIForCapture();
        
        // 2. Use html2canvas to capture the entire body element
        // You could capture a specific wrapper, but capturing the body is safe here.
        const canvas = await html2canvas(document.body, {
            useCORS: true, // Important for external resources (like map tiles)
            allowTaint: true, // Should be true if useCORS is true, but useCORS is better
            backgroundColor: null, // Makes background transparent if not styled
            scale: 2, // Optional: Capture at a higher resolution for better quality
            scrollX: 0, // Prevent scrolling issues
            scrollY: 0, // Prevent scrolling issues
            windowWidth: document.documentElement.offsetWidth,
            windowHeight: document.documentElement.offsetHeight,
        });

        // 3. Convert the canvas to a blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
        if (!blob) throw new Error("Failed to create image blob from canvas.");
        
        const url = URL.createObjectURL(blob);

        // 4. Restore UI
        restoreUI();
        button.innerHTML = originalText;
        button.disabled = false;

        // 5. Show preview / download dialog
        showShareDialog(url, blob);

    } catch (error) {
        console.error('Failed to generate image:', error);

        // Ensure UI is restored on error
        restoreUI(); 
        if (button) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
        alert('Sorry, could not generate the image. Please try again.');
    }
}

function showShareDialog(imageUrl, blob) {
  // Remove existing dialog if any
  const existingDialog = document.getElementById('shareDialog');
  if (existingDialog) existingDialog.remove();
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.id = 'shareDialog';
  dialog.innerHTML = `
    <div class="share-dialog-overlay">
      <div class="share-dialog-content">
        <h3>Share Your Travel Map</h3>
        <div class="image-preview">
          <img src="${imageUrl}" alt="Your travel map" />
        </div>
        <div class="share-actions">
          <button id="downloadBtn" class="btn btn-primary">📥 Download Image</button>
          <button id="closeBtn" class="btn btn-outline">Close</button>
        </div>
        <p class="share-hint">Share your travel progress with friends! 🌍</p>
      </div>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(dialog);
  
  // Event handlers
  document.getElementById('downloadBtn').addEventListener('click', () => {
    downloadImage(imageUrl);
  });
  
  document.getElementById('closeBtn').addEventListener('click', () => {
    closeShareDialog(dialog, imageUrl);
  });
  
  // Close on overlay click
  dialog.querySelector('.share-dialog-overlay').addEventListener('click', (e) => {
    if (e.target === dialog.querySelector('.share-dialog-overlay')) {
      closeShareDialog(dialog, imageUrl);
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeShareDialog(dialog, imageUrl);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function downloadImage(imageUrl) {
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = `my-travel-map-${new Date().toISOString().split('T')[0]}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function closeShareDialog(dialog, imageUrl) {
  if (dialog && dialog.parentNode) {
    dialog.parentNode.removeChild(dialog);
  }
  // Clean up the object URL to prevent memory leaks
  if (imageUrl) {
    URL.revokeObjectURL(imageUrl);
  }
}
