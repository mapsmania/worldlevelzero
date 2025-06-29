function loadHomePage() {
  try {
    if (confirm("Return to the TripGeo home page ?")) {
      window.parent.LoadHomePage();
    }
  } catch {
    console.error("send data error");
  }
}
// Check if URL parameters exist
function hasURLParams() {
  return new URLSearchParams(window.location.search).toString() !== "";
}

function sendDataToParent(data) {
  try {
    window.parent.Update_WLZ_URL(data);
  } catch {
    console.error("send data error");
  }
}

// Function to load map state from URL parameters
function loadMapStateFromURL() {
  const urlParams = new URLSearchParams(window.location.search.slice(1));
  const storedColors = {};
  let scoreFromURL = 0; // Track the score from the URL

  // If URL has parameters, use them to set the map state
  urlParams.forEach((value, key) => {
    const scoreValue = parseInt(value, 10);
    const countryIso = key;
    const label = Object.keys(scoreIncrements).find(
      (label) => scoreIncrements[label] === scoreValue
    );
    const color = colorOptions[label];
    storedColors[countryIso] = color;
    scoreFromURL += scoreValue; // Accumulate score from URL parameters
  });

  // If there are URL parameters, return the state and score from the URL
  if (Object.keys(storedColors).length > 0) {
    return { storedColors, scoreFromURL }; // Return both colors and score
  }

  return null; // No URL parameters found
}

function loadMapState() {
  // Check if there are URL parameters first
  const urlState = loadMapStateFromURL();

  // If URL parameters exist, use them
  if (urlState) {
    return urlState; // Return the colors and score from URL
  } else {
    // No URL params, load from local storage
    const storedColors =
      JSON.parse(localStorage.getItem("polygonColors")) || {};
    const score = parseInt(localStorage.getItem("score")) || 0;

    // If there are stored colors in local storage, update the URL with them
    if (Object.keys(storedColors).length > 0 && !hasURLParams()) {
      const urlParams = new URLSearchParams();

      Object.keys(storedColors).forEach((iso_a2_eh) => {
        const scoreValue =
          scoreIncrements[
            Object.keys(colorOptions).find(
              (label) => colorOptions[label] === storedColors[iso_a2_eh]
            )
          ] || 0;
        urlParams.set(iso_a2_eh, scoreValue);
      });

      // Update the URL with local storage parameters
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.pushState({}, "", newUrl);
      sendDataToParent(urlParams.toString()); // Send updated params to parent if necessary
    }

    // Return the map state from local storage
    return {
      storedColors: storedColors,
      score: score,
    };
  }
}

// Define score increments for each option
const scoreIncrements = {
  "Lived Here": 4,
  "Stayed Here": 3,
  "Visited Here": 2,
  "Passed Through": 1,
  "Never Been Here": 0,
};

// Define color options and button background colors
const colorOptions = {
  "Lived Here": "#ff0000", // Red
  "Stayed Here": "#ff4c4c", // Light Red
  "Visited Here": "#ff8c1a", // Orange
  "Passed Through": "#a6e62c", // Light Green
  "Never Been Here": "#ffffff", // White
};

const buttonBackgroundColor = {
  "Never Been Here": "#d5e0d8", // Gray background for the button
};

// Initialize score and colors from the appropriate source
let score = 0;
let storedColors = {};

// Load saved state from local storage or URL
const mapState = loadMapState();
if (mapState) {
  storedColors = mapState.storedColors; // Colors for the map
  score = mapState.scoreFromURL || mapState.score; // Use score from URL or local storage
}

// Function to update URL with country selection
function updateURLWithCountrySelection(isoCode, scoreValue) {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set(isoCode, scoreValue);
  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.pushState({}, "", newUrl);
  // Create data object to send to the parent
  sendDataToParent(urlParams.toString());
}

function saveMapState(iso_a2_eh, color, scoreValue) {
  let polygonColors = JSON.parse(localStorage.getItem("polygonColors")) || {};
  polygonColors[iso_a2_eh] = color;
  localStorage.setItem("polygonColors", JSON.stringify(polygonColors));

  // Save the current score to localStorage
  localStorage.setItem("score", score);

  updateURLWithCountrySelection(iso_a2_eh, scoreValue);
}

function generateURLWithParams() {
  const storedColors = JSON.parse(localStorage.getItem("polygonColors")) || {};
  console.log("Stored Colors:", storedColors); // Debugging statement

  const params = Object.keys(storedColors)
    .map((iso_a2_eh) => {
      const score =
        scoreIncrements[
          Object.keys(colorOptions).find(
            (label) => colorOptions[label] === storedColors[iso_a2_eh]
          )
        ] || 0;
      return `${iso_a2_eh}=${score}`;
    })
    .join("&");

  const url = `https://tripgeo.com/worldlevelzero/?${params}`;
  console.log("Generated URL:", url); // Debugging statement
  return url;
}

function postScoreToBluesky(score) {
  const urlWithParams = generateURLWithParams();
  const message = encodeURIComponent(
    `🌍 I am World Level ${score}! <br> Check out my map: ${urlWithParams}`
  );
  const blueskyPostUrl = `https://bsky.app/intent/compose?text=${message}`;
  console.log("Bluesky Post URL:", blueskyPostUrl); // Debugging statement
  window.open(blueskyPostUrl, "_blank");
}

function postScoreToTwitter(score) {
  const urlWithParams = generateURLWithParams();
  const message = encodeURIComponent(
    `🌍 I am World Level ${score}! Check out my map: ${urlWithParams}`
  );
  const TwitterPostUrl = `https://twitter.com/intent/tweet?text=${message}`;
  console.log("Twitter Post URL:", TwitterPostUrl); // Debugging statement
  window.open(TwitterPostUrl, "_blank");
}

function postScoreToFacebook(score) {
  const url = "https://tripgeo.com/worldlevelzero";
  const message = encodeURIComponent(
    `🌍 I am World Level ${score}! \nWhat is your World Level?`
  );
  const facebookShareUrl = `https://www.facebook.com/dialog/share?app_id=YOUR_APP_ID&href=${encodeURIComponent(
    url
  )}&quote=${message}`;
  window.open(facebookShareUrl, "_blank", "width=600,height=400");
}

// Function to update the URL parameters in your map and posting functions
function updateMapStateAndPost() {
  const urlWithParams = generateURLWithParams();
  // Update the map state (this function would handle map and local storage updates if needed)
  console.log("Updated map state URL:", urlWithParams);

  // Optionally call the post functions
  // postScoreToBluesky(score);
  // postScoreToTwitter(score);
}

// Update score display function
function updateScore(score) {
  const scoreTextElement = document.getElementById("score-text");
  if (scoreTextElement) {
    scoreTextElement.textContent = `World Level: ${score}`;
  }
  console.log("Updated Score:", score);
}

function resetMap() {
  // Show confirmation dialog
  const confirmation = window.confirm("Are You Sure You Want to Delete all Your Map Data?");
  
  if (confirmation) {
    // User clicked 'OK', proceed with reset
    localStorage.removeItem("score");
    localStorage.removeItem("polygonColors");
    score = 0;
    updateScore(score);

    // Reset the polygon colors on the map
    map.eachLayer(function (layer) {
      if (layer instanceof L.GeoJSON) {
        layer.eachLayer(function (featureLayer) {
          featureLayer.setStyle({
            fillColor: "white",
          });
          featureLayer.options.currentColor = "white";
        });
      }
    });

    // Remove query params from the URL
    window.history.pushState({}, "", window.location.pathname);
    sendDataToParent("");

    console.log("Map reset. URL params cleared."); // Debugging statement
  } else {
    // User clicked 'Cancel', do nothing
    console.log("Map reset canceled.");
  }
}

// Add an event listener for keydown events
document.addEventListener("keydown", function (event) {
  if (event.shiftKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    resetMap();
  }
});

// Add an event listener for the reset button
document.getElementById("reset-button").addEventListener("click", resetMap);

// Initialize the map
const map = L.map("map", {
  center: [40.9798, 3.8671],
  zoom: 2,
  zoomSnap: 0.5,
  zoomDelta: 0.5,
});

// Add a tile layer with attribution
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Add GeoJSON layer to the map
L.geoJSON(freeBus, {
  style: function (feature) {
    const iso_a2_eh = feature.properties.iso_a2_eh;
    const fillColor = storedColors[iso_a2_eh] || "white";
    return {
      fillColor: fillColor,
      color: "black",
      weight: 2,
      fillOpacity: 1,
    };
  },
  onEachFeature: function (feature, layer) {
    const iso_a2_eh = feature.properties.iso_a2_eh;

    if (feature.properties && feature.properties.name) {
      layer.bindTooltip(feature.properties.name, {
        permanent: false,
        direction: "top",
        className: "polygon-tooltip",
        offset: [0, -10],
      });
    }

    let buttonsHtml = "";
    for (const [label, color] of Object.entries(colorOptions)) {
      const buttonStyle =
        label === "Never Been Here"
          ? `background-color: ${buttonBackgroundColor[label]};`
          : `background-color: ${color};`;

      buttonsHtml += `
        <button 
          class="color-button" 
          data-label="${label}" 
          data-color="${color}" 
          style="${buttonStyle}"
        >
          ${label}
        </button>
      `;
    }

    const options = `
      <p>${feature.properties.name}</p>
      <div>${buttonsHtml}</div>
    `;

    layer.bindPopup(options, {
      maxWidth: 300,
      closeButton: true,
      className: "polygon-popup",
    });

    layer.on("popupopen", function () {
      const popupElement = layer.getPopup().getElement();
      const buttons = popupElement.querySelectorAll(".color-button");
      buttons.forEach((button) => {
        button.addEventListener("click", function () {
          const newLabel = this.getAttribute("data-label");
          const newColor = this.getAttribute("data-color");

          layer.setStyle({
            fillColor: newColor,
          });

          const previousColor = layer.options.currentColor;
          const previousLabel = Object.keys(colorOptions).find(
            (label) => colorOptions[label] === previousColor
          );
          const previousScore = scoreIncrements[previousLabel] || 0;

          const newScore = scoreIncrements[newLabel];
          score = score - previousScore + newScore;

          layer.options.currentColor = newColor;
          layer.options.currentScore = newScore;

          saveMapState(iso_a2_eh, newColor, newScore);

          console.log("Updated Score:", score);
          updateScore(score);
        });
      });
    });
  },
}).addTo(map);

// Initial call to update the score display
updateScore(score);
