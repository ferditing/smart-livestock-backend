#!/usr/bin/env ts-node
/**
 * Quick mock test for backend worker
 * Tests worker logic WITHOUT requiring database
 */

import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

async function testWorkerWithMock() {
  console.log('\n========================================');
  console.log('BACKEND WORKER MOCK TEST');
  console.log('========================================');
  console.log(`ML Service: ${ML_SERVICE_URL}\n`);

  // Mock report (simulating what would come from database)
  const mockReports = [
    {
      id: 100,
      animal_type: 'cow',
      age: 5,
      body_temperature: 38.5,
      symptoms: JSON.stringify(['fever', 'cough', 'lethargy'])
    },
    {
      id: 101,
      animal_type: 'goat',
      age: 2,
      body_temperature: 39.2,
      symptoms: JSON.stringify(['loss of appetite'])
    },
    {
      id: 102,
      animal_type: 'sheep',
      age: 3,
      body_temperature: 37.8,
      symptoms: JSON.stringify([])
    }
  ];

  console.log(`Testing with ${mockReports.length} mock reports...\n`);

  for (const report of mockReports) {
    try {
      // Replicate worker logic
      const mlPayload = {
        animal_type: report.animal_type,
        age: report.age ?? 0,
        body_temperature: report.body_temperature ?? 0,
        symptoms: Array.isArray(report.symptoms)
          ? report.symptoms
          : JSON.parse(report.symptoms || '[]')
      };

      console.log(`📋 Report #${report.id} (${report.animal_type})`);
      console.log(`   Payload:`, JSON.stringify(mlPayload).slice(0, 100) + '...');

      // Call ML service
      const mlResp = await axios.post(`${ML_SERVICE_URL}/predict`, mlPayload, { timeout: 10000 });
      const data = mlResp.data;

      console.log(`   ✓ Prediction: ${data.predicted_label}`);
      console.log(`   ✓ Confidence: ${data.confidence}\n`);
    } catch (err: any) {
      console.error(`   ✗ Failed: ${err?.message || err}\n`);
    }
  }

  console.log('========================================\n');
}

testWorkerWithMock().catch(console.error);
