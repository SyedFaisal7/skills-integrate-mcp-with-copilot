document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const selectedActivityPanel = document.getElementById("selected-activity");

  let activities = {};
  let selectedActivityName = null;
  let map;
  let markerLayer;
  let activityMarkers = new Map();

  function initMap() {
    if (typeof L === "undefined") {
      return;
    }

    map = L.map("map").setView([40.7128, -74.0060], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  function getCategoryLabel(category) {
    switch (category) {
      case "sports":
        return "Sports";
      case "arts":
        return "Arts";
      case "technology":
        return "Technology";
      case "academics":
        return "Academics";
      default:
        return "General";
    }
  }

  function getCategoryClass(category) {
    switch (category) {
      case "sports":
        return "sports";
      case "arts":
        return "arts";
      case "technology":
        return "technology";
      case "academics":
        return "academics";
      default:
        return "general";
    }
  }

  function updateSelectedActivityPanel(name) {
    if (!selectedActivityPanel) {
      return;
    }

    if (!name || !activities[name]) {
      selectedActivityPanel.innerHTML =
        "Select an activity card or map marker to see details.";
      return;
    }

    const details = activities[name];
    const spotsLeft = details.max_participants - details.participants.length;
    const category = getCategoryLabel(details.category);
    const location = details.location || {};

    selectedActivityPanel.innerHTML = `
      <strong>${name}</strong><br />
      <span>${details.description}</span><br />
      <strong>Schedule:</strong> ${details.schedule}<br />
      <strong>Category:</strong> ${category}<br />
      <strong>Availability:</strong> ${spotsLeft} spots left<br />
      <strong>Location:</strong> ${location.address || "TBD"}
    `;
  }

  function selectActivity(name) {
    if (!name || !activities[name]) {
      return;
    }

    selectedActivityName = name;
    activitySelect.value = name;
    updateSelectedActivityPanel(name);

    document.querySelectorAll(".activity-card").forEach((card) => {
      card.classList.toggle("selected", card.dataset.activity === name);
    });

    const marker = activityMarkers.get(name);
    if (marker && map) {
      map.panTo(marker.getLatLng());
      marker.openPopup();
    }
  }

  function renderMap() {
    if (!map || !markerLayer) {
      return;
    }

    markerLayer.clearLayers();
    activityMarkers = new Map();

    const points = [];

    Object.entries(activities).forEach(([name, details]) => {
      const location = details.location || {};
      const lat = Number(location.lat);
      const lng = Number(location.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      points.push([lat, lng]);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "map-pin-wrapper",
          html: `<div class="map-pin ${getCategoryClass(details.category)}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(markerLayer);

      marker.bindPopup(`<strong>${name}</strong><br />${details.description}`);
      marker.on("click", () => selectActivity(name));
      activityMarkers.set(name, marker);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.2));
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        activityCard.dataset.activity = name;

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <p><strong>Location:</strong> ${details.location?.address || "TBD"}</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activityCard.addEventListener("click", () => selectActivity(name));
        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          handleUnregister(event);
        });
      });

      renderMap();
      if (!selectedActivityName && Object.keys(activities).length > 0) {
        selectActivity(Object.keys(activities)[0]);
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target.closest("button");
    const activity = button?.getAttribute("data-activity");
    const email = button?.getAttribute("data-email");

    if (!activity || !email) {
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";
        signupForm.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  initMap();
  fetchActivities();
});
