document.addEventListener('DOMContentLoaded', () => {
  // Load current profile data
  fetch('/profile')
    .then(res => res.json())
    .then(data => {
      document.getElementById('username').value = data.username || '';
      document.getElementById('email').value = data.email || '';
      document.getElementById('mobile').value = data.mobile || '';
      document.getElementById('gender').value = data.gender || '';
      document.getElementById('language').value = data.language || '';
      if (data.dob) {
        document.getElementById('dob').value = data.dob.split('T')[0];
      }
    });

  // Submit updated profile
  document.getElementById('profileForm').addEventListener('submit', e => {
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
      .catch(err => {
        console.error('Error updating profile:', err);
        alert('Failed to update profile.');
      });
  });
});
