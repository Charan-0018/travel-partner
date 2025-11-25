// dashboard.js

// Load user profile data and show greeting, profile panel:
function loadProfile() {
  fetch('/profile')
    .then(res => {
      if (!res.ok) throw new Error('Not logged in');
      return res.json();
    })
    .then(data => {
      const username = data.username || 'Traveler';
      document.getElementById('usernameGreeting').textContent = username;
      document.getElementById('pName').textContent = username;
      document.getElementById('pEmail').textContent = data.email || 'Not set';
      document.getElementById('pMobile').textContent = data.mobile || 'N/A';
    })
    .catch(() => {
      document.getElementById('usernameGreeting').textContent = 'Traveler';
    });
}

// Show trips hosted and joined by user
function showMyTrips() {
  const section = document.getElementById('myTripsSection');
  section.style.display = 'block';
  document.getElementById('travelBuddiesSection').style.display = 'none';

  fetch('/my-trips')
    .then(res => res.json())
    .then(data => {
      const hosted = data.hosted || [];
      const joined = data.joined || [];

      const hostedDiv = document.getElementById('hostedTrips');
      const joinedDiv = document.getElementById('joinedTrips');

      hostedDiv.innerHTML = hosted.length ? hosted.map(trip => `
        <div class="trip-card">
          <h4>${trip.destination} (${trip.vehicle})</h4>
          <p><b>Dates:</b> ${trip.start_date} to ${trip.end_date}</p>
          <p><b>Budget:</b> ₹${trip.budget}</p>
          <p>${trip.description || ''}</p>
        </div>
      `).join('') : '<p>You have not hosted any trips yet.</p>';

      joinedDiv.innerHTML = joined.length ? joined.map(trip => `
        <div class="trip-card">
          <h4>${trip.destination} (${trip.vehicle})</h4>
          <p><b>Dates:</b> ${trip.start_date} to ${trip.end_date}</p>
          <p><b>Budget:</b> ₹${trip.budget}</p>
          <p>Hosted by: ${trip.username}</p>
          <p>${trip.description || ''}</p>
        </div>
      `).join('') : '<p>You have not joined any trips yet.</p>';
    })
    .catch(err => {
      section.innerHTML = `<p style="color:red;">Failed to load trips: ${err.message}</p>`;
    });
}

// Hide My Trips section
function hideMyTrips() {
  document.getElementById('myTripsSection').style.display = 'none';
}

// Show Travel Buddies and list all matches with clickable cards
function showTravelBuddies() {
  const listDiv = document.getElementById('buddiesList');
  document.getElementById('travelBuddiesSection').style.display = 'block';
  document.getElementById('myTripsSection').style.display = 'none';

  listDiv.textContent = 'Loading...';

  fetch('/travel-buddies')
    .then(res => res.json())
    .then(buddies => {
      if (!buddies.length) {
        listDiv.innerHTML = '<p>No compatible travel buddies found.</p>';
        return;
      }

      // Render buddies as clickable cards
      listDiv.innerHTML = buddies.map(buddy => `
        <div class="trip-card buddy-card" data-hostid="${buddy.id}" style="cursor: pointer;">
          <h4>${buddy.username}</h4>
          <p><b>Compatibility Score:</b> ${buddy.score}</p>
          <div class="buddy-trips" style="margin-top: 10px;"></div>
        </div>
      `).join('');

      // Attach click listeners to each buddy card
      document.querySelectorAll('.buddy-card').forEach(card => {
        card.addEventListener('click', () => {
          const tripsContainer = card.querySelector('.buddy-trips');
          const hostId = card.getAttribute('data-hostid');

          // Toggle trips view if already loaded
          if (tripsContainer.innerHTML.trim()) {
            tripsContainer.innerHTML = '';
            return;
          }

          tripsContainer.innerHTML = 'Loading trips...';

          fetch(`/trips-by-host/${hostId}`)
            .then(res => res.json())
            .then(trips => {
              if (trips.length === 0) {
                tripsContainer.innerHTML = '<p>No trips found for this partner.</p>';
                return;
              }
              tripsContainer.innerHTML = trips.map(t => `
                <div style="border-top: 1px solid #ccc; padding: 8px 0;">
                  <strong>${t.destination}</strong> (${t.vehicle})<br>
                  Dates: ${t.start_date} - ${t.end_date}<br>
                  Budget: ₹${t.budget}
                </div>
              `).join('');
            })
            .catch(() => {
              tripsContainer.innerHTML = '<p>Error loading trips.</p>';
            });
        });
      });
    })
    .catch(() => {
      listDiv.innerHTML = '<p>Failed to load travel buddies.</p>';
    });
}

// Hide Travel Buddies section
function hideTravelBuddies() {
  document.getElementById('travelBuddiesSection').style.display = 'none';
}

// Initial page setup
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  // optionally call showTravelBuddies(); on load or attach to UI trigger/button
});
