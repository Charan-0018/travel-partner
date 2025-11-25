document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const tripDetailEl = document.getElementById('tripDetail');

    // Load Trip Detail & Participants
    fetch(`/trip/${id}`)
        .then(res => res.json())
        .then(trip => {
            const startDate = new Date(trip.start_date);
            const endDate = new Date(trip.end_date);
            const startFormatted = `${String(startDate.getDate()).padStart(2,'0')}-${String(startDate.getMonth()+1).padStart(2,'0')}-${startDate.getFullYear()}`;
            const endFormatted = `${String(endDate.getDate()).padStart(2,'0')}-${String(endDate.getMonth()+1).padStart(2,'0')}-${endDate.getFullYear()}`;

            const participantsHTML = trip.participants.length
                ? trip.participants.map(p =>
                    p.mobile 
                        ? `<li class="host">${p.username} - Mobile: ${p.mobile}</li>`
                        : `<li>${p.username}</li>`
                ).join('')
                : '<li>No participants yet</li>';

            tripDetailEl.innerHTML = `
                <h2>${trip.destination} (${trip.vehicle})</h2>
                <p class="dates">Dates: ${startFormatted} to ${endFormatted}</p>
                <p class="budget">Budget: ₹${trip.budget}</p>
                <p>${trip.description || ''}</p>
                <h4>Participants</h4>
                <ul class="participants-list">${participantsHTML}</ul>
            `;
        })
        .catch(() => alert('Could not load trip details.'));

    // Join Request Form Submit
    const joinForm = document.getElementById('joinForm');
    joinForm?.addEventListener('submit', e => {
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
                alert('Join Request Sent!');
                e.target.reset();
            } else {
                alert('Error sending request.');
            }
        })
        .catch(() => alert('Error sending join request.'));
    });
});
