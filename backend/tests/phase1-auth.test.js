const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { generateToken } = require('../utils/jwt');

// Helper to make local HTTP requests to the test app
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

const runPhase1Tests = async () => {
  console.log('====================================================');
  console.log('      VitaLink Phase 1 Authentication Tests         ');
  console.log('====================================================\n');

  // Connect to DB if not already connected
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

  // Start an ephemeral test server listening on an available port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  console.log(`[Test Runner] Ephemeral test server listening on port ${testPort}`);

  try {
    // Generate unique test emails with timestamp
    const ts = Date.now();
    const patientEmail = `test.patient.${ts}@example.com`;
    const doctorEmail = `test.doctor.${ts}@example.com`;
    const shippingEmail = `test.shipping.${ts}@example.com`;

    // TEST 1: Admin registration rejection on public endpoint
    console.log('\n--- 1. Public Registration Security Restrictions ---');
    const adminAttempt = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Fake Admin Attempt',
      email: `fake.admin.${ts}@example.com`,
      phone: '9998887770',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'admin'
    });
    assert(
      adminAttempt.status === 403 && adminAttempt.data?.code === 'ADMIN_REGISTRATION_FORBIDDEN',
      'Rejects attempt to register "admin" role on public /register endpoint (403)'
    );

    // TEST 2: Unsupported role rejection
    const invalidRoleAttempt = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Hacker User',
      email: `hacker.${ts}@example.com`,
      phone: '9998887771',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      role: 'super_admin'
    });
    assert(
      invalidRoleAttempt.status === 400 && invalidRoleAttempt.data?.code === 'INVALID_ROLE',
      'Rejects unsupported role assignment (400)'
    );

    // TEST 3: Successful Patient Registration
    console.log('\n--- 2. Valid Role Registrations (Patient, Doctor, Shipping) ---');
    const patientReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Aarav Patel',
      email: patientEmail,
      phone: '9876543201',
      gender: 'male',
      dateOfBirth: '1996-03-12',
      address: '101 Lotus Enclave',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      password: 'PatientPassword123!',
      confirmPassword: 'PatientPassword123!',
      role: 'patient'
    });
    assert(
      patientReg.status === 201 && patientReg.data?.success === true,
      'Registers new Patient successfully (201)'
    );
    assert(
      patientReg.data?.data?.user?.role === 'patient',
      'Assigned role is "patient"'
    );
    assert(
      patientReg.data?.data?.user?.password === undefined,
      'Password hash is never returned in registration response'
    );
    assert(
      typeof patientReg.data?.data?.token === 'string' && patientReg.data.data.token.length > 20,
      'Valid JWT token issued upon registration'
    );

    const patientToken = patientReg.data?.data?.token;

    // TEST 4: Duplicate Email Rejection
    const dupReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Aarav Duplicate',
      email: patientEmail,
      phone: '9876543209',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      role: 'patient'
    });
    assert(
      dupReg.status === 400 && dupReg.data?.code === 'EMAIL_EXISTS',
      'Rejects duplicate email registration (400)'
    );

    // TEST 5: Doctor Registration
    const doctorReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Dr. Sunita Rao',
      email: doctorEmail,
      phone: '9876543202',
      gender: 'female',
      dateOfBirth: '1988-07-25',
      address: 'Suite 40, Fortis Hospital',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      password: 'DoctorPassword123!',
      confirmPassword: 'DoctorPassword123!',
      role: 'doctor'
    });
    assert(
      doctorReg.status === 201 && doctorReg.data?.data?.user?.role === 'doctor',
      'Registers Doctor role successfully (201)'
    );

    // TEST 6: Shipping Partner Registration
    const shippingReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Vikas Express Delivery',
      email: shippingEmail,
      phone: '9876543203',
      gender: 'male',
      dateOfBirth: '1993-11-04',
      address: 'Plot 12, MIDC Logistics Hub',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      pinCode: '400703',
      password: 'ShippingPassword123!',
      confirmPassword: 'ShippingPassword123!',
      role: 'shipping'
    });
    assert(
      shippingReg.status === 201 && shippingReg.data?.data?.user?.role === 'shipping',
      'Registers Shipping Partner role successfully (201)'
    );

    // TEST 7: Login Workflow
    console.log('\n--- 3. Authentication & Login Workflows ---');
    // Pre-verify test patient email to permit login in Phase 1 regression test
    await User.updateOne({ email: patientEmail }, { isEmailVerified: true });

    const patientLogin = await request(server, 'POST', '/api/v1/auth/login', {
      email: patientEmail,
      password: 'PatientPassword123!'
    });
    assert(
      patientLogin.status === 200 && patientLogin.data?.success === true,
      'Authenticates patient with valid credentials (200)'
    );
    assert(
      patientLogin.data?.data?.user?.password === undefined,
      'Password hash is never returned in login response'
    );

    // TEST 8: Wrong Password Login Failure
    const badLogin = await request(server, 'POST', '/api/v1/auth/login', {
      email: patientEmail,
      password: 'WrongPassword999!'
    });
    assert(
      badLogin.status === 401 && badLogin.data?.code === 'INVALID_CREDENTIALS',
      'Rejects login with invalid password (401)'
    );

    // TEST 9: Protected /me Endpoint with JWT
    console.log('\n--- 4. Protected Route & Session Verification (/me) ---');
    const meSuccess = await request(server, 'GET', '/api/v1/auth/me', null, patientToken);
    assert(
      meSuccess.status === 200 && meSuccess.data?.data?.user?.email === patientEmail,
      'Protected GET /api/v1/auth/me returns authenticated user details'
    );
    assert(
      meSuccess.data?.data?.user?.password === undefined,
      'Password hash is never exposed on /api/v1/auth/me'
    );

    // TEST 10: Protected /me without Token
    const meNoToken = await request(server, 'GET', '/api/v1/auth/me', null, null);
    assert(
      meNoToken.status === 401 && meNoToken.data?.code === 'AUTH_NO_TOKEN',
      'Rejects unauthenticated request without token (401)'
    );

    // TEST 11: Protected /me with Tampered/Invalid Token
    const meBadToken = await request(server, 'GET', '/api/v1/auth/me', null, 'tampered.jwt.signature');
    assert(
      meBadToken.status === 401 && meBadToken.data?.code === 'AUTH_TOKEN_INVALID',
      'Rejects request with invalid/tampered token (401)'
    );

    // TEST 12: Admin Login Role Verification
    console.log('\n--- 5. Administrative Authentication Role Enforcement ---');
    const patientAdminLoginAttempt = await request(server, 'POST', '/api/v1/auth/admin-login', {
      email: patientEmail,
      password: 'PatientPassword123!'
    });
    assert(
      patientAdminLoginAttempt.status === 403 && patientAdminLoginAttempt.data?.code === 'ADMIN_ROLE_REQUIRED',
      'Rejects non-admin user on /admin-login even with valid credentials (403)'
    );

    // Cleanup created test records
    await User.deleteMany({
      email: { $in: [patientEmail, doctorEmail, shippingEmail] }
    });
    console.log('\n[Test Runner] Cleaned up temporary test user records.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Runner] Ephemeral test server closed.');
    await disconnectDB();
  }

  console.log('====================================================');
  console.log(`Phase 1 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase1Tests().catch((err) => {
  console.error('[Test Fatal Error]:', err);
  process.exit(1);
});
