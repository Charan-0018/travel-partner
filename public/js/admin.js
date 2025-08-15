document.addEventListener('DOMContentLoaded', () => {
    fetch('/trips')
        .then(res => res.json())
        .then(trips => {
            const container = document.getElementById('admin-data');
            container.innerHTML = '<h3>All Trips</h3>';
            trips.forEach(t => {
                container.innerHTML += `<p>${t.destination} by ${t.username}</p>`;
            });
        });
});
