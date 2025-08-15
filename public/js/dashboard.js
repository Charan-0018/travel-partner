document.addEventListener('DOMContentLoaded', () => {
    fetch('/trips')
        .then(res => res.json())
        .then(trips => {
            const container = document.getElementById('latest-trips');
            trips.forEach(t => {
                container.innerHTML += `
                    <div>
                        <h3>${t.destination}</h3>
                        <p>${t.start_date} - ${t.end_date}</p>
                        <a href="trip.html?id=${t.id}">View Details</a>
                    </div><hr>`;
            });
        });
});
