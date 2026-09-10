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
const { __getLastTestDispatchedOtp } = require('../services/emailService');

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

const runEmailVerificationTests = async () => {
  console.log('====================================================');
  console.log('    VitaLink Email Verification OTP Test Suite      ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
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
  const port = server.address().port;
  console.log(`[Test Runner] Ephemeral test server active on port ${port}\n`);

  const ts = Date.now();
  const testEmail = `otp_test_${ts}@vitalink.com`;
  const testPassword = 'SecurePassword123!';

  try {
    // ----------------------------------------------------
    // TEST 1: Registration creates unverified user
    // ----------------------------------------------------
    console.log('--- Section 1: Registration & Initial Unverified State ---');
    const regRes = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Vikram Mehta',
      email: testEmail,
      phone: '9876543210',
      gender: 'male',
      dateOfBirth: '1992-05-18',
      address: '42 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400020',
      password: testPassword,
      confirmPassword: testPassword,
      role: 'patient'
    });

    assert(regRes.status === 201, 'Registration returns HTTP 201 Created');
    assert(regRes.data?.data?.isEmailVerified === false, 'Requirement 1: Registration creates unverified user (isEmailVerified: false)');

    const initialDispatchedOtp = __getLastTestDispatchedOtp();
    assert(
      typeof initialDispatchedOtp === 'string' && /^\d{6}$/.test(initialDispatchedOtp),
      'Requirement 2: Secure 6-digit numeric OTP generated server-side'
    );

    // ----------------------------------------------------
    // TEST 2: OTP is stored hashed, not plaintext in DB
    // ----------------------------------------------------
    console.log('\n--- Section 2: Cryptographic Hash Storage Security ---');
    const userInDb = await User.findOne({ email: testEmail }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationLastSentAt'
    );

    assert(userInDb !== null, 'User saved in database');
    assert(userInDb.emailVerificationOtpHash !== undefined, 'OTP hash field populated');
    assert(
      userInDb.emailVerificationOtpHash !== initialDispatchedOtp,
      'Requirement 3: Raw OTP is NEVER stored in database'
    );
    assert(
      userInDb.emailVerificationOtpHash.length === 64,
      'Requirement 3b: Stored OTP is a 64-character SHA-256 HMAC hash'
    );
    assert(
      userInDb.emailVerificationOtpExpiresAt > new Date(),
      'Requirement 3c: OTP expiration timestamp set in the future'
    );

    // ----------------------------------------------------
    // TEST 3: Login is blocked before email verification
    // ----------------------------------------------------
    console.log('\n--- Section 3: Login Guard Enforcement ---');
    const unverifiedLogin = await request(server, 'POST', '/api/v1/auth/login', {
      email: testEmail,
      password: testPassword
    });

    assert(
      unverifiedLogin.status === 403,
      'Requirement 11: Login is blocked before email verification (403 Forbidden)'
    );
    assert(
      unverifiedLogin.data?.code === 'EMAIL_NOT_VERIFIED',
      'Requirement 11b: Response explicitly returns code EMAIL_NOT_VERIFIED'
    );

    // ----------------------------------------------------
    // TEST 4: Wrong OTP is rejected
    // ----------------------------------------------------
    console.log('\n--- Section 4: Invalid & Expired OTP Rejection ---');
    const wrongOtpRes = await request(server, 'POST', '/api/v1/auth/verify-email', {
      email: testEmail,
      otp: '000000'
    });

    assert(
      wrongOtpRes.status === 400 && wrongOtpRes.data?.code === 'INVALID_OTP',
      'Requirement 5: Wrong OTP is rejected with HTTP 400 and INVALID_OTP'
    );

    const userAfterWrongAttempt = await User.findOne({ email: testEmail }).select('+emailVerificationOtpAttempts');
    assert(
      userAfterWrongAttempt.emailVerificationOtpAttempts === 1,
      'Requirement 5b: Failed attempts counter incremented'
    );

    // ----------------------------------------------------
    // TEST 5: Expired OTP is rejected
    // ----------------------------------------------------
    // Artificially expire the OTP
    await User.updateOne(
      { email: testEmail },
      { emailVerificationOtpExpiresAt: new Date(Date.now() - 60000) }
    );

    const expiredOtpRes = await request(server, 'POST', '/api/v1/auth/verify-email', {
      email: testEmail,
      otp: initialDispatchedOtp
    });

    assert(
      expiredOtpRes.status === 400 && expiredOtpRes.data?.code === 'OTP_EXPIRED',
      'Requirement 6: Expired OTP is rejected with HTTP 400 and OTP_EXPIRED'
    );

    // ----------------------------------------------------
    // TEST 6: Resend OTP & Cooldown Throttling
    // ----------------------------------------------------
    console.log('\n--- Section 5: Resend Mechanism & Cooldown Enforcement ---');
    // Currently emailVerificationLastSentAt was set on registration just seconds ago
    const throttledResend = await request(server, 'POST', '/api/v1/auth/resend-verification', {
      email: testEmail
    });

    assert(
      throttledResend.status === 429 && throttledResend.data?.code === 'RESEND_COOLDOWN_ACTIVE',
      'Requirement 10: Resend cooldown rejects rapid repeated requests (HTTP 429)'
    );

    // Simulate cooldown period passing by resetting lastSentAt
    await User.updateOne(
      { email: testEmail },
      { emailVerificationLastSentAt: new Date(Date.now() - 70000) }
    );

    const validResend = await request(server, 'POST', '/api/v1/auth/resend-verification', {
      email: testEmail
    });

    assert(
      validResend.status === 200 && validResend.data?.code === 'OTP_RESENT',
      'Requirement 8: Resend generates a new OTP after cooldown expires (HTTP 200)'
    );

    const newDispatchedOtp = __getLastTestDispatchedOtp();
    assert(
      newDispatchedOtp !== initialDispatchedOtp,
      'Requirement 8b: Resend generates a DIFFERENT random 6-digit OTP'
    );

    // ----------------------------------------------------
    // TEST 7: Old OTP becomes invalid
    // ----------------------------------------------------
    console.log('\n--- Section 6: Previous OTP Invalidation ---');
    const tryOldOtp = await request(server, 'POST', '/api/v1/auth/verify-email', {
      email: testEmail,
      otp: initialDispatchedOtp
    });

    assert(
      tryOldOtp.status === 400 && tryOldOtp.data?.code === 'INVALID_OTP',
      'Requirement 9: Previous OTP is invalid after resend'
    );

    // ----------------------------------------------------
    // TEST 8: Correct OTP is accepted & account verified
    // ----------------------------------------------------
    console.log('\n--- Section 7: Verification Success & OTP Cleanup ---');
    const verifySuccess = await request(server, 'POST', '/api/v1/auth/verify-email', {
      email: testEmail,
      otp: newDispatchedOtp
    });

    assert(
      verifySuccess.status === 200 && verifySuccess.data?.code === 'EMAIL_VERIFIED',
      'Requirement 4: Verification endpoint accepts correct OTP (HTTP 200)'
    );

    const verifiedUserInDb = await User.findOne({ email: testEmail }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts'
    );

    assert(
      verifiedUserInDb.isEmailVerified === true,
      'Requirement 4b: isEmailVerified updated to true'
    );
    assert(
      verifiedUserInDb.emailVerificationOtpHash === undefined,
      'Requirement 4c: emailVerificationOtpHash cleared from database'
    );
    assert(
      verifiedUserInDb.emailVerificationOtpExpiresAt === undefined,
      'Requirement 4d: emailVerificationOtpExpiresAt cleared from database'
    );

    // ----------------------------------------------------
    // TEST 9: Used OTP cannot be reused
    // ----------------------------------------------------
    console.log('\n--- Section 8: Replay Prevention & Post-Verification Login ---');
    const reuseAttempt = await request(server, 'POST', '/api/v1/auth/verify-email', {
      email: testEmail,
      otp: newDispatchedOtp
    });

    assert(
      reuseAttempt.data?.code === 'ALREADY_VERIFIED',
      'Requirement 7: Used OTP cannot be reused (returns ALREADY_VERIFIED)'
    );

    // ----------------------------------------------------
    // TEST 10: Login works after email verification
    // ----------------------------------------------------
    const verifiedLogin = await request(server, 'POST', '/api/v1/auth/login', {
      email: testEmail,
      password: testPassword
    });

    assert(
      verifiedLogin.status === 200 && verifiedLogin.data?.success === true,
      'Requirement 12: Login succeeds after email verification (HTTP 200)'
    );
    assert(
      typeof verifiedLogin.data?.data?.token === 'string',
      'Requirement 12b: Valid JWT token issued upon login'
    );
    assert(
      verifiedLogin.data?.data?.user?.role === 'patient',
      'Requirement 13: Existing role-based authorization intact (role: patient)'
    );

  } finally {
    // Clean up test user
    await User.deleteMany({ email: testEmail });
    server.close();
    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log(`Email Verification Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runEmailVerificationTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
