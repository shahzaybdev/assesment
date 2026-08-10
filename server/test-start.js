const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  // Test 1: Valid invitation with no existing attempt
  const t1 = await post('/api/assessments/INV-0039/start', {});
  console.log('Test 1 (Valid, new):', t1);

  // Test 2: Same invitation again — should return same attempt, not duplicate
  const t2 = await post('/api/assessments/INV-0039/start', {});
  console.log('Test 2 (Idempotent):', t2);
  console.log('  Same attempt ID?', t1.body.attemptId === t2.body.attemptId);

  // Test 3: Invalid invitation
  const t3 = await post('/api/assessments/INV-INVALID/start', {});
  console.log('Test 3 (Invalid):', t3);

  // Test 4: Already completed invitation (INV-0001 has ATT-0001 which is Completed)
  const t4 = await post('/api/assessments/INV-0001/start', {});
  console.log('Test 4 (Completed):', t4);
}

run().catch(console.error);
