const BASE_URL = 'https://travel-partner-backend-5d9c.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  // Load current profile data
  fetch(`${BASE_URL}/profile`)
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

      // Populate travel styles and interests (array expected)
      const setSelectedOptions = (selectId, values) => {
        const select = document.getElementById(selectId);
        if (!values) return;
        for (const option of select.options) {
          option.selected = values.includes(option.value);
        }
      };

      // Parse JSON strings if needed, else set empty array
      let travelStyles = [];
      let interests = [];
      try {
        travelStyles = typeof data.travel_styles === 'string' ? JSON.parse(data.travel_styles) : (data.travel_styles || []);
      } catch {}
      try {
        interests = typeof data.interests === 'string' ? JSON.parse(data.interests) : (data.interests || []);
      } catch {}

      setSelectedOptions('travelStyles', travelStyles);
      setSelectedOptions('interests', interests);
    })
    .catch(() => {
      // silently fail
    });

  // Handle form submission
  document.getElementById('profileForm').addEventListener('submit', e => {
    e.preventDefault();
    const updatedData = {
      username: document.getElementById('username').value.trim(),
      email: document.getElementById('email').value.trim(),
      mobile: document.getElementById('mobile').value.trim(),
      gender: document.getElementById('gender').value,
      language: document.getElementById('language').value.trim(),
      dob: document.getElementById('dob').value,
      travel_styles: [...document.getElementById('travelStyles').selectedOptions].map(opt => opt.value),
      interests: [...document.getElementById('interests').selectedOptions].map(opt => opt.value)
    };
    fetch(`${BASE_URL}/profile`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(updatedData)
    })
    .then(res => res.text())
    .then(msg => alert(msg))
    .catch(() => alert('Error updating profile'));
  });
});
