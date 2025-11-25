const BASE_URL = 'https://travel-partner-backend-5d9c.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    fetch(`${BASE_URL}/trips`)
        .then(res => res.json())
        .then(trips => {
            const container = document.getElementById('admin-data');
            container.innerHTML = '<h3>All Trips</h3>';
            trips.forEach(t => {
                container.innerHTML += `<p>${t.destination} by ${t.username}</p>`;
            });
        });
});
