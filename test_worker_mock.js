// Quick mock test for backend worker (plain JS)
// Run: node test_worker_mock.js

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

async function testWorkerWithMock() {
  console.log('\n========================================');
  console.log('BACKEND WORKER MOCK TEST (JS)');
  console.log('========================================');
  console.log('ML Service:', ML_SERVICE_URL, '\n');

  const mockReports = [
    { id: 100, animal_type: 'cow', age: 5, body_temperature: 38.5, symptoms: JSON.stringify(['fever','cough']) },
    { id: 101, animal_type: 'goat', age: 2, body_temperature: 39.2, symptoms: JSON.stringify(['loss of appetite']) },
    { id: 102, animal_type: 'sheep', age: 3, body_temperature: 37.8, symptoms: JSON.stringify([]) }
  ];

  console.log('Testing with', mockReports.length, 'mock reports...\n');

  for (const report of mockReports) {
    try {
      const mlPayload = {
        animal_type: report.animal_type,
        age: report.age || 0,
        body_temperature: report.body_temperature || 0,
        symptoms: Array.isArray(report.symptoms) ? report.symptoms : JSON.parse(report.symptoms || '[]')
      };

      console.log('Report #'+report.id+' ('+report.animal_type+')');
      console.log('  Payload:', JSON.stringify(mlPayload));

      const mlResp = await axios.post(ML_SERVICE_URL + '/predict', mlPayload, { timeout: 10000 });
      const data = mlResp.data;

      console.log('  Prediction:', data.predicted_label);
      console.log('  Confidence:', data.confidence, '\n');
    } catch (err) {
      console.error('  Failed:', err && err.message ? err.message : err, '\n');
    }
  }

  console.log('========================================\n');
}

testWorkerWithMock().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
