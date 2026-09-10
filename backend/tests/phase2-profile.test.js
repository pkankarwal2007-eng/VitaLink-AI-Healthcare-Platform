const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');

const request = (server, method, path, data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runPhase2Tests = async () => {
  console.log('====================================================');
  console.log('      VitaLink Phase 2 Profile & Route Tests        ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
    console.log('[Test Runner] Connecting to database...');
    await connectDB();
  }

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  console.log(`[Test Runner] Ephemeral test server listening on port ${testPort}`);

  const ts = Date.now();
  const testEmail = `phase2.patient.${ts}@example.com`;
  const doctorEmail = `phase2.doctor.${ts}@example.com`;
  const shippingEmail = `phase2.shipping.${ts}@example.com`;

  try {
    // 1. Setup Patient
    const regRes = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Vikram Joshi',
      email: testEmail,
      phone: '9811223344',
      gender: 'male',
      dateOfBirth: '1990-05-15',
      address: 'Old Address 123',
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      role: 'patient'
    });
    const patientToken = regRes.data?.data?.token;
    assert(regRes.status === 201 && !!patientToken, 'Test patient registered successfully');

    // 2. Test Updating Profile
    console.log('\n--- 1. Profile Field Updates & Persistence ---');
    const updateRes = await request(server, 'PUT', '/api/v1/auth/profile', {
      fullName: 'Vikram Joshi Updated',
      phone: '9899001122',
      address: 'New Residence, 45 Civil Lines',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122001'
    }, patientToken);

    assert(
      updateRes.status === 200 && updateRes.data?.success === true,
      'PUT /api/v1/auth/profile updates profile successfully (200)'
    );
    assert(
      updateRes.data?.data?.user?.fullName === 'Vikram Joshi Updated' &&
      updateRes.data?.data?.user?.city === 'Gurugram' &&
      updateRes.data?.data?.user?.pinCode === '122001',
      'Profile fields updated with new values'
    );

    // 3. Verify Database Persistence via GET /api/v1/auth/me
    console.log('\n--- 2. Profile Fetch Verification ---');
    const meRes = await request(server, 'GET', '/api/v1/auth/me', null, patientToken);
    assert(
      meRes.status === 200 &&
      meRes.data?.data?.user?.city === 'Gurugram' &&
      meRes.data?.data?.user?.phone === '9899001122',
      'GET /api/v1/auth/me reflects persisted updates from database'
    );

    // 4. Test Role Immutability Attack
    console.log('\n--- 3. Role & Email Security Immutability ---');
    const attackRes = await request(server, 'PUT', '/api/v1/auth/profile', {
      role: 'admin',
      email: 'hacked.admin@vitalink.com'
    }, patientToken);

    assert(
      attackRes.status === 200,
      'PUT /api/v1/auth/profile handles extra fields without crashing'
    );
    assert(
      attackRes.data?.data?.user?.role === 'patient',
      'SECURITY: Role is immutable via profile update (remains "patient", not "admin")'
    );
    assert(
      attackRes.data?.data?.user?.email === testEmail,
      'SECURITY: Registered email is immutable via profile update'
    );

    // 5. Test Doctor Profile
    console.log('\n--- 4. Clinician & Logistics Profiles ---');
    const docReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Dr. Shalini Gupta',
      email: doctorEmail,
      phone: '9822334455',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      role: 'doctor'
    });
    const docToken = docReg.data?.data?.token;

    const docUpdate = await request(server, 'PUT', '/api/v1/auth/profile', {
      address: 'Max Healthcare Clinic',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pinCode: '201301'
    }, docToken);

    assert(
      docUpdate.status === 200 && docUpdate.data?.data?.user?.city === 'Noida',
      'Clinician profile update persists successfully'
    );

    // 6. Test Shipping Partner Profile
    const shipReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Rajesh Express Logistics',
      email: shippingEmail,
      phone: '9833445566',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      role: 'shipping'
    });
    const shipToken = shipReg.data?.data?.token;

    const shipUpdate = await request(server, 'PUT', '/api/v1/auth/profile', {
      address: 'Central Logistics Terminal',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560068'
    }, shipToken);

    assert(
      shipUpdate.status === 200 && shipUpdate.data?.data?.user?.city === 'Bengaluru',
      'Shipping partner profile update persists successfully'
    );

    // 7. Test Unauthenticated Update Rejection
    console.log('\n--- 5. Unauthorized Access Protection ---');
    const unauthUpdate = await request(server, 'PUT', '/api/v1/auth/profile', {
      fullName: 'Hacker Change'
    }, null);

    assert(
      unauthUpdate.status === 401 && unauthUpdate.data?.code === 'AUTH_NO_TOKEN',
      'Rejects unauthenticated profile update with 401'
    );

    // Cleanup
    await User.deleteMany({
      email: { $in: [testEmail, doctorEmail, shippingEmail] }
    });
    console.log('\n[Test Runner] Cleaned up temporary test user records.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Runner] Ephemeral test server closed.');
    await disconnectDB();
  }

  console.log('====================================================');
  console.log(`Phase 2 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase2Tests().catch((err) => {
  console.error('[Phase 2 Test Error]:', err);
  process.exit(1);
});
