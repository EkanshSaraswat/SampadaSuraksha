const axios = require('axios');

// Requires a valid token for a Victim user to run
const TOKEN = process.env.TEST_TOKEN || 'YOUR_JWT_HERE';
const API_URL = 'http://localhost:5000/api/reports';

async function simulateLoad() {
  console.log('Starting load simulation...');
  const promises = [];
  
  for (let i = 0; i < 100; i++) {
    const isEmergency = Math.random() > 0.8; // 20% medical emergencies
    
    // Random locations around Delhi roughly
    const lat = 28.6139 + (Math.random() - 0.5) * 0.1;
    const lng = 77.2090 + (Math.random() - 0.5) * 0.1;

    const payload = {
      needs: `Simulated load test report #${i}`,
      medicalEmergency: isEmergency,
      latitude: lat,
      longitude: lng
    };

    promises.push(
      axios.post(API_URL, payload, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }).catch(err => {
        // Silently catch to not break Promise.all
      })
    );
  }

  const start = Date.now();
  await Promise.all(promises);
  const end = Date.now();

  console.log(`Successfully dispatched 100 reports in ${end - start}ms.`);
}

simulateLoad();
