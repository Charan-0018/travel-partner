function loadRequests() {
    fetch('/my-trip-requests')
        .then(res => res.json())
        .then(requests => {
            const container = document.getElementById('requestsContainer');
            container.innerHTML = '';

            if (requests.length === 0) {
                container.innerHTML = '<p>No pending requests.</p>';
                return;
            }

            requests.forEach(req => {
                const card = document.createElement('div');
                card.className = 'request-card';
                card.innerHTML = `
                    <p><b>Trip:</b> ${req.destination}</p>
                    <p><b>Requester:</b> ${req.requester_name}</p>
                    <p><b>Message:</b> ${req.message || '—'}</p>
                    <div class="action-buttons">
                        <button class="btn-approve" onclick="handleAction(${req.id}, 'accepted')">Approve</button>
                        <button class="btn-reject" onclick="handleAction(${req.id}, 'rejected')">Reject</button>
                    </div>
                `;
                container.appendChild(card);
            });
        });
}

function handleAction(id, action) {
    fetch(`/trip-requests/${id}/${action}`, { method: 'POST' })
        .then(res => res.text())
        .then(msg => {
            alert(msg);
            loadRequests(); // refresh list
        })
        .catch(() => alert('Error updating request.'));
}

// Load requests on page load
document.addEventListener('DOMContentLoaded', loadRequests);
