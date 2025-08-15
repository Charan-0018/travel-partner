document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    // ===== Load Trip Detail & Participants =====
    fetch(`/trip/${id}`)
        .then(r => r.json())
        .then(trip => {
            // Format the start and end dates
            const startDate = new Date(trip.start_date);
            const endDate = new Date(trip.end_date);

            const startFormatted = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}`;
            const endFormatted = `${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${endDate.getFullYear()}`;

            // Build participants list
            const participantsHTML = trip.participants.length
                ? trip.participants.map(p =>
                    p.mobile
                        ? `<li>${p.username} - Mobile: ${p.mobile}</li>` // host
                        : `<li>${p.username}</li>` // normal participant
                  ).join('')
                : '<li>No participants yet</li>';

            // Render trip details
            document.getElementById('trip-detail').innerHTML = `
                <h2>${trip.destination} (${trip.vehicle})</h2>
                <p><b>Budget:</b> ${trip.budget}</p>
                <p>${trip.description || ''}</p>
                <p><b>Dates:</b> from ${startFormatted} to ${endFormatted}</p>
                <h4>Participants:</h4>
                <ul>${participantsHTML}</ul>
            `;
        })
        .catch(err => {
            console.error('Error loading trip details:', err);
            alert('Could not load trip details.');
        });

    // ===== Join Request Form Submit =====
    const joinForm = document.getElementById('join-form');
    if (joinForm) {
        joinForm.addEventListener('submit', e => {
            e.preventDefault();
            const message = e.target.message.value.trim();

            if (!message) {
                alert('Please enter a message before sending your join request.');
                return;
            }

            fetch(`/trip/${id}/request-join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            })
            .then(res => {
                if (res.ok) {
                    alert('Join request sent!');
                    e.target.reset();
                } else if (res.status === 401 || res.redirected) {
                    window.location.href = '/login.html';
                } else {
                    alert('Error sending join request.');
                }
            })
            .catch(err => {
                console.error('Error sending join request:', err);
                alert('Error sending join request.');
            });
        });
    }
});
