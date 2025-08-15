function searchTrips() {
    const location = document.getElementById('prefLocation').value.trim();
    const budget = document.getElementById('prefBudget').value.trim() || 99999;

    fetch(`/trips?location=${encodeURIComponent(location)}&budget=${budget}`)
      .then(res => res.json())
      .then(trips => {
        const list = document.getElementById('trip-list');
        list.innerHTML = '';
        if (!trips.length) {
            list.innerHTML = '<p>No trips match your preferences.</p>';
            return;
        }
        trips.forEach(t => {
            list.innerHTML += `
                <div>
                    <h3>${t.destination} (${t.vehicle})</h3>
                    <p>Budget: ${t.budget}</p>
                    <p>Dates: ${t.start_date} - ${t.end_date}</p>
                    <a href="trip.html?id=${t.id}">View Details</a>
                </div><hr>
            `;
        });
      });
}

// Search automatically on page load with empty preferences to show all trips
document.addEventListener('DOMContentLoaded', searchTrips);
