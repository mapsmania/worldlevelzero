    // Initialize the map
    const map = new maplibregl.Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [0, 20],
      zoom: 2,
    });

    // Load the GeoJSON once the map style is ready
    map.on("load", async () => {
      try {
        const response = await fetch("world.geojson");
        if (!response.ok) throw new Error("Failed to load GeoJSON");
        const worldData = await response.json();

        // Add GeoJSON source
        map.addSource("world", {
          type: "geojson",
          data: worldData,
        });

        // Add filled polygons
        map.addLayer({
          id: "world-fill",
          type: "fill",
          source: "world",
          paint: {
            "fill-color": "#0080ff",
            "fill-opacity": 0.3,
          },
        });

        // Add outline
        map.addLayer({
          id: "world-outline",
          type: "line",
          source: "world",
          paint: {
            "line-color": "#004080",
            "line-width": 1,
          },
        });

        // Popup on click
        map.on("click", "world-fill", (e) => {
          const props = e.features[0].properties;
          const name = props.name || props.admin || "Unknown";
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`<strong>${name}</strong>`)
            .addTo(map);
        });

        // Cursor changes on hover
        map.on("mouseenter", "world-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "world-fill", () => {
          map.getCanvas().style.cursor = "";
        });

      } catch (err) {
        console.error("Error loading world.geojson:", err);
      }
    });
