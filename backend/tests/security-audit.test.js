const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const TestReport = require('../models/TestReport');
const MedicineOrder = require('../models/MedicineOrder');
const ShippingProfile = require('../models/ShippingProfile');
const { ROLES, APPOINTMENT_STATUS, ORDER_STATUS } = require('../config/constants');
const { generateToken } = require('../utils/jwt');

const request = (server, method, endpoint, data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = {
      hostname: '127.0.0.1',
      port,
      path: endpoint,
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
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
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

const runSecurityAuditTests = async () => {
  console.log('====================================================');
  console.log('       VitaLink Security Hardening Audit Suite       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  };

  await connectDB();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Runner] Ephemeral test server active on port ${port}\n`);

  const ts = Date.now();
  let patientA, patientB, doctorA, doctorB, shippingA, shippingB, adminUser;
  let tokenPatientA, tokenPatientB, tokenDoctorA, tokenDoctorB, tokenShippingA, tokenShippingB, tokenAdmin;

  try {
    // Setup Test Users
    patientA = await User.create({
      fullName: 'Patient Alpha',
      email: `patient_alpha_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000001',
      gender: 'male',
      dateOfBirth: new Date('1992-01-01'),
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.PATIENT,
      isEmailVerified: true
    });
    tokenPatientA = generateToken(patientA);

    patientB = await User.create({
      fullName: 'Patient Beta',
      email: `patient_beta_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000002',
      gender: 'female',
      dateOfBirth: new Date('1994-05-15'),
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      role: ROLES.PATIENT,
      isEmailVerified: true
    });
    tokenPatientB = generateToken(patientB);

    doctorA = await User.create({
      fullName: 'Dr. Alice Specialist',
      email: `doctor_alice_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000003',
      gender: 'female',
      dateOfBirth: new Date('1985-08-20'),
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.DOCTOR,
      isEmailVerified: true
    });
    tokenDoctorA = generateToken(doctorA);

    doctorB = await User.create({
      fullName: 'Dr. Bob Clinician',
      email: `doctor_bob_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000004',
      gender: 'male',
      dateOfBirth: new Date('1982-11-10'),
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      role: ROLES.DOCTOR,
      isEmailVerified: true
    });
    tokenDoctorB = generateToken(doctorB);

    shippingA = await User.create({
      fullName: 'Courier Partner A',
      email: `shipping_a_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000005',
      gender: 'male',
      dateOfBirth: new Date('1996-03-22'),
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.SHIPPING,
      isEmailVerified: true
    });
    tokenShippingA = generateToken(shippingA);

    shippingB = await User.create({
      fullName: 'Courier Partner B',
      email: `shipping_b_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000006',
      gender: 'other',
      dateOfBirth: new Date('1998-07-07'),
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.SHIPPING,
      isEmailVerified: true
    });
    tokenShippingB = generateToken(shippingB);

    adminUser = await User.create({
      fullName: 'Admin Test Officer',
      email: `admin_sec_${ts}@test.vitalink.com`,
      password: 'Password123!',
      phone: '9000000007',
      gender: 'other',
      dateOfBirth: new Date('1980-01-01'),
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.ADMIN,
      isEmailVerified: true
    });
    tokenAdmin = generateToken(adminUser);

    // Create an authorized consultation between Patient A and Doctor A
    const appointmentA = await Appointment.create({
      patient: patientA._id,
      doctor: doctorA._id,
      date: new Date(Date.now() + 24 * 3600 * 1000),
      timeSlot: { start: '10:00', end: '10:30' },
      consultationType: 'chat',
      fee: 500,
      reason: 'General checkup',
      status: APPOINTMENT_STATUS.CONFIRMED
    });

    // Create Prescription for Patient A by Doctor A
    const prescriptionA = await Prescription.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointment: appointmentA._id,
      clinicalAssessment: 'Mild respiratory allergy',
      medications: [{ name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: '5 days', price: 60 }],
      testsRecommended: ['Complete Blood Count'],
      advice: 'Stay hydrated',
      date: new Date()
    });

    // Create MedicalRecord for Patient A
    const recordA = await MedicalRecord.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointment: appointmentA._id,
      recordType: 'clinical_note',
      title: 'Initial Consultation Assessment',
      summary: 'Patient examined with mild allergy symptoms',
      date: new Date()
    });

    // Create TestReport for Patient A
    const reportA = await TestReport.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointment: appointmentA._id,
      testName: 'Complete Blood Count',
      category: 'CBC',
      status: 'recommended',
      date: new Date()
    });

    // Create MedicineOrder for Patient A assigned to Shipping A
    const orderA = await MedicineOrder.create({
      orderNumber: `ORD-SEC-${ts}`,
      trackingNumber: `TRK-SEC-${ts}`,
      prescription: prescriptionA._id,
      patient: patientA._id,
      doctor: doctorA._id,
      shippingPartner: shippingA._id,
      items: [{ name: 'Cetirizine', dosage: '10mg', quantity: 1, unitPrice: 60, totalPrice: 60, instructions: 'Night' }],
      deliveryAddress: { fullName: 'Patient Alpha', phone: '9000000001', street: '1st St', city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' },
      subtotal: 60,
      deliveryFee: 40,
      totalAmount: 100,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: ORDER_STATUS.ASSIGNED,
      statusHistory: [{ status: ORDER_STATUS.ASSIGNED, timestamp: new Date(), note: 'Assigned to Shipping A', updatedBy: adminUser._id }]
    });

    console.log('--- 1. IDOR Defense: Patient Records Isolation ---');
    // Scenario 1: Patient A -> own records = allowed (200)
    const ownRecRes = await request(server, 'GET', `/api/v1/medical/records/${recordA._id}`, null, tokenPatientA);
    assert(ownRecRes.status === 200, 'Scenario 1: Patient can access own medical record (200 OK)');

    // Scenario 2: Patient B -> Patient A's records = denied (403)
    const otherRecRes = await request(server, 'GET', `/api/v1/medical/records/${recordA._id}`, null, tokenPatientB);
    assert(otherRecRes.status === 403, 'Scenario 2: Patient B is denied access to Patient A medical record (403 Forbidden)');

    // Scenario 3: Patient A -> own prescription = allowed (200)
    const ownPrescRes = await request(server, 'GET', `/api/v1/medical/prescriptions/${prescriptionA._id}`, null, tokenPatientA);
    assert(ownPrescRes.status === 200, 'Scenario 3: Patient can access own prescription (200 OK)');

    // Scenario 4: Patient B -> Patient A's prescription = denied (403)
    const otherPrescRes = await request(server, 'GET', `/api/v1/medical/prescriptions/${prescriptionA._id}`, null, tokenPatientB);
    assert(otherPrescRes.status === 403, 'Scenario 4: Patient B is denied access to Patient A prescription (403 Forbidden)');

    console.log('\n--- 2. IDOR Defense: Doctor Consultation Boundaries ---');
    // Scenario 5: Doctor A (with appointment relationship) -> patient records = allowed (200)
    const docWithRelRes = await request(server, 'GET', `/api/v1/medical/records?patientId=${patientA._id}`, null, tokenDoctorA);
    assert(docWithRelRes.status === 200, 'Scenario 5: Doctor with consultation relationship can view patient records (200 OK)');

    // Scenario 6: Doctor B (unauthorized, no relationship) -> patient records = denied (403)
    const docNoRelRes = await request(server, 'GET', `/api/v1/medical/records?patientId=${patientA._id}`, null, tokenDoctorB);
    assert(docNoRelRes.status === 403, 'Scenario 6: Doctor without consultation relationship is denied patient records (403 Forbidden)');

    // Doctor B attempting to create medical record for Patient A without consultation = denied (403)
    const docBCreateRecRes = await request(server, 'POST', '/api/v1/medical/records', {
      patientId: patientA._id,
      title: 'Unauthorized Record',
      summary: 'Doctor B has no relationship'
    }, tokenDoctorB);
    assert(docBCreateRecRes.status === 403, 'Doctor without consultation cannot create medical record for patient (403 Forbidden)');

    // Doctor B attempting to recommend test for Patient A without consultation = denied (403)
    const docBRecommendRes = await request(server, 'POST', '/api/v1/medical/reports/recommend', {
      patientId: patientA._id,
      testName: 'Unauthorized MRI'
    }, tokenDoctorB);
    assert(docBRecommendRes.status === 403, 'Doctor without consultation cannot recommend diagnostic tests (403 Forbidden)');

    console.log('\n--- 3. Logistics Boundaries: Shipping Partner Access ---');
    // Scenario 7: Assigned shipping partner -> assigned order = allowed (200)
    const shipAssignedRes = await request(server, 'GET', `/api/v1/orders/${orderA._id}`, null, tokenShippingA);
    assert(shipAssignedRes.status === 200, 'Scenario 7: Assigned shipping partner can view assigned order (200 OK)');

    // Scenario 8: Unassigned shipping partner -> unrelated order = denied (403)
    const shipUnassignedRes = await request(server, 'GET', `/api/v1/orders/${orderA._id}`, null, tokenShippingB);
    assert(shipUnassignedRes.status === 403, 'Scenario 8: Unassigned shipping partner is denied access to order (403 Forbidden)');

    // Tracking endpoint: Unrelated Patient B -> Patient A's order track = denied (403)
    const trackDeniedRes = await request(server, 'GET', `/api/v1/orders/${orderA._id}/track`, null, tokenPatientB);
    assert(trackDeniedRes.status === 403, 'Unrelated user cannot access order tracking information (403 Forbidden)');

    console.log('\n--- 4. Role-Based Access Control (RBAC) Hardening ---');
    // Scenario 9: Normal user -> admin endpoint = denied (403)
    const adminEndpointRes = await request(server, 'GET', '/api/v1/admin/users', null, tokenPatientA);
    assert(adminEndpointRes.status === 403, 'Scenario 9: Normal user accessing admin endpoint is denied (403 Forbidden)');

    // Scenario 10: Patient -> doctor-only endpoint = denied (403)
    const patientDoctorOnlyRes = await request(server, 'GET', '/api/v1/doctors/profile/me', null, tokenPatientA);
    assert(patientDoctorOnlyRes.status === 403, 'Scenario 10: Patient accessing doctor-only endpoint is denied (403 Forbidden)');

    // Scenario 11: Doctor -> patient-only endpoint = denied (403)
    const doctorPatientOnlyRes = await request(server, 'POST', '/api/v1/ai/chat', { message: 'Health inquiry' }, tokenDoctorA);
    assert(doctorPatientOnlyRes.status === 403, 'Scenario 11: Doctor accessing patient-only AI chat is denied (403 Forbidden)');

    console.log('\n--- 5. Administrative Protection Boundary ---');
    // Admin user deactivation attempt on an admin account is blocked (403)
    const adminDeactivateRes = await request(server, 'PATCH', `/api/v1/admin/users/${adminUser._id}/status`, {}, tokenAdmin);
    assert(
      adminDeactivateRes.status === 400 || adminDeactivateRes.status === 403,
      'Admin accounts cannot be deactivated via status toggle endpoint'
    );

    console.log('\n--- 6. NoSQL Operator Injection Sanitization ---');
    // Attempting query parameter injection with $gt or $ne
    const noSqlRes = await request(server, 'POST', '/api/v1/auth/login', {
      email: { $gt: '' },
      password: 'password'
    });
    // The sanitizer strips $gt, resulting in an empty or invalid email object
    assert(
      noSqlRes.status === 400 && (noSqlRes.data?.code === 'CREDENTIALS_REQUIRED' || noSqlRes.data?.code === 'INVALID_CREDENTIALS'),
      'Injected MongoDB operators ($gt, $ne) are sanitized before query execution'
    );

    console.log('\n--- 7. Diagnostic Report File Security & Wildcard Fallback Removal ---');
    // Non-existent report file returns 404 cleanly without leaking any other report file
    const ghostReport = await TestReport.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointment: appointmentA._id,
      testName: 'Ghost Nonexistent Test',
      reportFileName: 'nonexistent-ghost-report.pdf',
      reportFileUrl: '/api/v1/medical/reports/fake-id/file',
      date: new Date()
    });

    const fileRes = await request(server, 'GET', `/api/v1/medical/reports/${ghostReport._id}/file`, null, tokenPatientA);
    assert(
      fileRes.status === 404 && fileRes.data?.code === 'FILE_NOT_FOUND',
      'Missing report file returns 404 FILE_NOT_FOUND; wildcard leakage fallback is completely eliminated'
    );

    console.log('\n--- 8. Security Headers & Information Disclosure ---');
    const healthRes = await request(server, 'GET', '/api/health');
    assert(
      !healthRes.headers['x-powered-by'],
      'X-Powered-By header is removed from HTTP responses'
    );

  } finally {
    // Cleanup temporary test records
    await Promise.all([
      User.deleteMany({ email: { $regex: `@test\\.vitalink\\.com$` } }),
      Appointment.deleteMany({ reason: 'General checkup' }),
      Prescription.deleteMany({ clinicalAssessment: 'Mild respiratory allergy' }),
      MedicalRecord.deleteMany({ title: 'Initial Consultation Assessment' }),
      TestReport.deleteMany({ testName: { $in: ['Complete Blood Count', 'Ghost Nonexistent Test'] } }),
      MedicineOrder.deleteMany({ orderNumber: `ORD-SEC-${ts}` })
    ]).catch(() => {});

    server.close();
    await disconnectDB();
  }

  console.log(`\n====================================================`);
  console.log(`Security Audit Results: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

if (require.main === module) {
  runSecurityAuditTests().catch((err) => {
    console.error('Fatal Security Test Suite Error:', err);
    process.exit(1);
  });
}

module.exports = { runSecurityAuditTests };
