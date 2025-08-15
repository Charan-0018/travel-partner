document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/join.html') {
        fetch('/trips')
            .then(res => res.json())
            .then(trips => {
                const list = document.getElementById('trip-list');
                trips.forEach(t => {
                    list.innerHTML += `
                        <div>
                            <h3>${t.destination} (${t.vehicle})</h3>
                            <p>Budget: ${t.budget}</p>
                            <p>Dates: ${t.start_date} - ${t.end_date}</p>
                            <small>Hosted by: ${t.username}</small>
                        </div><hr>
                    `;
                });
            });
    }
});
