document.addEventListener('DOMContentLoaded', () => {
    // Load current profile data
    fetch('/profile')
        .then(res => {
            if (!res.ok) throw new Error('Not logged in');
            return res.json();
        })
        .then(data => {
            document.getElementById('username').value = data.username || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('mobile').value = data.mobile || '';
            document.getElementById('gender').value = data.gender || '';
            document.getElementById('language').value = data.language || '';
            if (data.dob) document.getElementById('dob').value = data.dob.split('T')[0];
        })
        .catch(() => { /* silently fail */ });

    // Submit updated profile
    document.getElementById('profileForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const profileData = {
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            mobile: document.getElementById('mobile').value.trim(),
            gender: document.getElementById('gender').value,
            language: document.getElementById('language').value.trim(),
            dob: document.getElementById('dob').value
        };

        fetch('/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        })
        .then(res => res.text())
        .then(msg => alert(msg))
        .catch(() => alert('Failed to update profile.'));
    });

    // Trip search
    const loadTrips = () => {
        const location = document.getElementById('location').value.trim();
        const budget = document.getElementById('budget').value.trim();
        let query = '/trips?';
        if (location) query += `location=${encodeURIComponent(location)}&`;
        if (budget) query += `budget=${encodeURIComponent(budget)}&`;
        fetch(query)
            .then(res => res.json())
            .then(trips => {
                const tripsContainer = document.getElementById('tripsContainer');
                tripsContainer.innerHTML = '';
                if (trips.length === 0) {
                    tripsContainer.innerHTML = '<p>No trips found.</p>';
                    return;
                }
                trips.forEach(trip => {
                    const startDate = new Date(trip.start_date);
                    const endDate = new Date(trip.end_date);
                    const startFormatted = `${String(startDate.getDate()).padStart(2,'0')}-${String(startDate.getMonth()+1).padStart(2,'0')}-${startDate.getFullYear()}`;
                    const endFormatted = `${String(endDate.getDate()).padStart(2,'0')}-${String(endDate.getMonth()+1).padStart(2,'0')}-${endDate.getFullYear()}`;
                    const card = document.createElement('div');
                    card.className = 'trip-card';
                    card.innerHTML = `
                        <h4>${trip.destination}</h4>
                        <p><b>Host:</b> ${trip.username}</p>
                        <p><b>Dates:</b> ${startFormatted} - ${endFormatted}</p>
                        <p><b>Budget:</b> ₹${trip.budget}</p>
                        <a href="trip.html?id=${trip.id}" class="view-btn">View Details</a>
                    `;
                    tripsContainer.appendChild(card);
                });
            });
    };

    document.getElementById('searchBtn').addEventListener('click', loadTrips);

    // Load all trips on page load
    loadTrips();
});
