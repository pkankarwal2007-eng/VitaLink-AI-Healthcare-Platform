const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const fs = require('fs');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const TestReport = require('../models/TestReport');
const { ROLES, VERIFICATION_STATUS, APPOINTMENT_STATUS, APPOINTMENT_TYPES } = require('../config/constants');
const { generateToken } = require('../utils/jwt');

// Helper for JSON HTTP requests
const request = (server, method, reqPath, data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
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

// Helper for multipart/form-data upload
const uploadMultipart = (server, method, reqPath, fieldName, filename, fileBuffer, mimeType, token) => {
  return new Promise((resolve, reject) => {
    const boundary = '----VitaLinkTestBoundary' + Date.now();
    const port = server.address().port;

    const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const body = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => { resBody += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: resBody, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// Helper for streaming binary GET
const requestBinary = (server, reqPath, token = null) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method: 'GET',
      headers: {}
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: Buffer.concat(chunks)
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
};

const runPhase7Tests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Phase 7 Medical Records, Prescriptions, ');
  console.log('          Tests & Secure Reports Test Suite         ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
    console.log('[Test Runner] Connecting to MongoDB Atlas...');
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
  console.log(`[Test Runner] Test server listening on port ${testPort}`);

  const ts = Date.now();
  const docEmail = `phase7.dr.${ts}@example.com`;
  const otherDocEmail = `phase7.dr2.${ts}@example.com`;
  const patEmail = `phase7.pat.${ts}@example.com`;
  const otherPatEmail = `phase7.pat2.${ts}@example.com`;
  const shippingEmail = `phase7.ship.${ts}@example.com`;

  let doctorUser, doctorToken;
  let otherDoctorUser, otherDoctorToken;
  let patientUser, patientToken;
  let otherPatientUser, otherPatientToken;
  let shippingUser, shippingToken;
  let testAppointment;
  let createdPrescriptionId;
  let createdTestReportId;

  try {
    // ----------------------------------------------------
    // SETUP: Users & Consultation Appointment Fixture
    // ----------------------------------------------------
    console.log('\n--- 1. Setting up Clinical Test Entities & Appointment ---');

    // Doctor 1
    doctorUser = await User.create({
      fullName: 'Dr. Vikram Malhotra',
      email: docEmail,
      phone: `987${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.DOCTOR,
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true
    });
    doctorToken = generateToken(doctorUser);

    // Doctor 2 (for unauthorized checks)
    otherDoctorUser = await User.create({
      fullName: 'Dr. Radhika Sen',
      email: otherDocEmail,
      phone: `986${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.DOCTOR,
      city: 'Delhi',
      state: 'Delhi',
      isActive: true
    });
    otherDoctorToken = generateToken(otherDoctorUser);

    // Patient 1
    patientUser = await User.create({
      fullName: 'Aarav Sharma',
      email: patEmail,
      phone: `985${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.PATIENT,
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true
    });
    patientToken = generateToken(patientUser);

    // Patient 2 (for isolation checks)
    otherPatientUser = await User.create({
      fullName: 'Diya Mehra',
      email: otherPatEmail,
      phone: `984${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.PATIENT,
      city: 'Pune',
      state: 'Maharashtra',
      isActive: true
    });
    otherPatientToken = generateToken(otherPatientUser);

    // Shipping Partner (forbidden from clinical data)
    shippingUser = await User.create({
      fullName: 'QuickDeliver Express',
      email: shippingEmail,
      phone: `983${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.SHIPPING,
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true
    });
    shippingToken = generateToken(shippingUser);

    // Active consultation appointment
    testAppointment = await Appointment.create({
      patient: patientUser._id,
      doctor: doctorUser._id,
      date: new Date(),
      timeSlot: { start: '10:00 AM', end: '10:30 AM' },
      consultationType: APPOINTMENT_TYPES.VIDEO,
      status: APPOINTMENT_STATUS.COMPLETED,
      reason: 'Persistent fever and productive cough',
      fee: 750
    });

    assert(!!doctorUser._id && !!patientUser._id && !!testAppointment._id, 'Clinical test users and appointment created');

    // ----------------------------------------------------
    // TEST 1: Doctor Creates Prescription with Auto-Sync
    // ----------------------------------------------------
    console.log('\n--- 2. Doctor Prescription Creation & Auto-Sync Pipeline ---');

    const rxPayload = {
      appointmentId: testAppointment._id.toString(),
      clinicalAssessment: 'Acute Bronchitis with secondary bacterial infection',
      medications: [
        {
          name: 'Amoxicillin & Clavulanate 625mg',
          dosage: '625mg',
          frequency: '1-0-1',
          duration: '5 days',
          instructions: 'Take after meals with plenty of water',
          price: 180
        },
        {
          name: 'Paracetamol 650mg',
          dosage: '650mg',
          frequency: 'SOS',
          duration: '3 days',
          instructions: 'For body ache or fever > 100°F',
          price: 45
        }
      ],
      testsRecommended: ['Complete Blood Count (CBC)', 'Chest X-Ray PA View'],
      advice: 'Steam inhalation twice daily. Strict bed rest for 48 hours.',
      followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    const createRxRes = await request(
      server,
      'POST',
      '/api/v1/medical/prescriptions',
      rxPayload,
      doctorToken
    );

    assert(createRxRes.status === 201, 'POST /api/v1/medical/prescriptions returns 201 Created');
    assert(createRxRes.data?.success === true, 'Prescription response indicates success: true');
    assert(createRxRes.data?.data?.medications?.length === 2, 'Prescription contains 2 prescribed medication items');
    assert(createRxRes.data?.data?.testsRecommended?.length === 2, 'Prescription contains 2 recommended diagnostic tests');
    createdPrescriptionId = createRxRes.data?.data?._id;

    // Verify auto-created MedicalRecord
    const autoMedicalRecord = await MedicalRecord.findOne({
      patient: patientUser._id,
      recordType: 'prescription'
    });
    assert(!!autoMedicalRecord, 'AUTO-SYNC: MedicalRecord of type "prescription" was automatically created');
    assert(autoMedicalRecord?.title?.includes('Prescription'), 'MedicalRecord title matches prescription assessment');

    // Verify auto-created TestReport placeholders
    const autoTestReports = await TestReport.find({
      patient: patientUser._id,
      appointment: testAppointment._id,
      status: 'recommended'
    });
    assert(
      autoTestReports.length === 2,
      `AUTO-SYNC: 2 TestReport records created with status "recommended" (found ${autoTestReports.length})`
    );
    createdTestReportId = autoTestReports[0]?._id?.toString();

    // ----------------------------------------------------
    // TEST 2: Prescription Validation & Authorization Guards
    // ----------------------------------------------------
    console.log('\n--- 3. Prescription Validation & Authorization Guards ---');

    // Reject missing medications
    const badRx1 = await request(
      server,
      'POST',
      '/api/v1/medical/prescriptions',
      {
        appointmentId: testAppointment._id.toString(),
        clinicalAssessment: 'Fever',
        medications: []
      },
      doctorToken
    );
    assert(badRx1.status === 400, 'Rejects prescription with empty medications (400 VALIDATION_ERROR)');

    // Reject missing clinicalAssessment
    const badRx2 = await request(
      server,
      'POST',
      '/api/v1/medical/prescriptions',
      {
        appointmentId: testAppointment._id.toString(),
        clinicalAssessment: '',
        medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: '3 days' }]
      },
      doctorToken
    );
    assert(badRx2.status === 400, 'Rejects prescription with missing clinical diagnosis (400)');

    // Reject unauthorized doctor
    const unauthDocRx = await request(
      server,
      'POST',
      '/api/v1/medical/prescriptions',
      rxPayload,
      otherDoctorToken
    );
    assert(unauthDocRx.status === 403, 'SECURITY: Unassigned doctor cannot issue prescription for appointment (403)');

    // Reject patient issuing prescription
    const patRxAttempt = await request(
      server,
      'POST',
      '/api/v1/medical/prescriptions',
      rxPayload,
      patientToken
    );
    assert(patRxAttempt.status === 403, 'SECURITY: Patient role cannot issue prescriptions (403)');

    // ----------------------------------------------------
    // TEST 3: Prescription Retrieval & Patient Isolation
    // ----------------------------------------------------
    console.log('\n--- 4. Prescription Retrieval & Role Isolation ---');

    // Patient gets own prescriptions
    const patRxRes = await request(
      server,
      'GET',
      '/api/v1/medical/prescriptions',
      null,
      patientToken
    );
    assert(patRxRes.status === 200, 'Patient can fetch their prescriptions (200)');
    assert(patRxRes.data?.data?.length >= 1, 'Patient receives their issued prescription');
    assert(
      patRxRes.data?.data[0]?._id === createdPrescriptionId,
      'Prescription matches created ID'
    );

    // Other patient cannot see this prescription in their list
    const otherPatRxRes = await request(
      server,
      'GET',
      '/api/v1/medical/prescriptions',
      null,
      otherPatientToken
    );
    assert(otherPatRxRes.status === 200, 'Other patient fetches their prescription list');
    const leakedRx = (otherPatRxRes.data?.data || []).find(p => p._id === createdPrescriptionId);
    assert(!leakedRx, 'DATA ISOLATION: Unrelated patient cannot see another patient’s prescription in list');

    // Other patient directly fetching prescription ID
    const directFetchOther = await request(
      server,
      'GET',
      `/api/v1/medical/prescriptions/${createdPrescriptionId}`,
      null,
      otherPatientToken
    );
    assert(directFetchOther.status === 403, 'DATA PRIVACY: Direct fetch by unrelated patient returns 403 FORBIDDEN');

    // Doctor gets issued prescriptions
    const docRxRes = await request(
      server,
      'GET',
      '/api/v1/medical/prescriptions',
      null,
      doctorToken
    );
    assert(docRxRes.status === 200, 'Doctor can fetch prescriptions issued by them (200)');
    assert(
      (docRxRes.data?.data || []).some(p => p._id === createdPrescriptionId),
      'Doctor sees the issued prescription in their practice list'
    );

    // Shipping partner forbidden
    const shipRxRes = await request(
      server,
      'GET',
      '/api/v1/medical/prescriptions',
      null,
      shippingToken
    );
    assert(shipRxRes.status === 403, 'ROLE SEPARATION: Shipping partner cannot access prescriptions (403 FORBIDDEN)');

    // ----------------------------------------------------
    // TEST 4: Medical Records Retrieval, Filtering & Search
    // ----------------------------------------------------
    console.log('\n--- 5. Medical Records History, Filtering & Search ---');

    // Patient gets medical records
    const patRecordsRes = await request(
      server,
      'GET',
      '/api/v1/medical/records',
      null,
      patientToken
    );
    assert(patRecordsRes.status === 200, 'Patient can fetch their medical records history (200)');
    assert(patRecordsRes.data?.data?.length >= 1, 'Medical records include auto-generated clinical events');

    // Filter by recordType=prescription
    const rxFilterRes = await request(
      server,
      'GET',
      '/api/v1/medical/records?recordType=prescription',
      null,
      patientToken
    );
    assert(rxFilterRes.status === 200, 'Filtering by recordType=prescription returns 200');
    assert(
      (rxFilterRes.data?.data || []).every(r => r.recordType === 'prescription'),
      'All filtered records match recordType "prescription"'
    );

    // Search records by keyword
    const searchRes = await request(
      server,
      'GET',
      '/api/v1/medical/records?search=Bronchitis',
      null,
      patientToken
    );
    assert(searchRes.status === 200, 'Keyword search query returns 200');
    assert(searchRes.data?.data?.length >= 1, 'Search finds matching record containing "Bronchitis"');

    // Doctor accesses records of authorized patient
    const docQueryPatRecords = await request(
      server,
      'GET',
      `/api/v1/medical/records?patientId=${patientUser._id}`,
      null,
      doctorToken
    );
    assert(docQueryPatRecords.status === 200, 'Doctor can view medical records for active consulted patient');

    // Unrelated doctor attempts to access patient's records
    const unauthDocRecords = await request(
      server,
      'GET',
      `/api/v1/medical/records?patientId=${patientUser._id}`,
      null,
      otherDoctorToken
    );
    assert(
      unauthDocRecords.status === 403,
      'SECURITY: Doctor without appointment relationship is denied patient records (403)'
    );

    // Shipping partner forbidden from medical records
    const shipRecRes = await request(
      server,
      'GET',
      '/api/v1/medical/records',
      null,
      shippingToken
    );
    assert(shipRecRes.status === 403, 'ROLE SEPARATION: Shipping partner cannot access medical records (403)');

    // ----------------------------------------------------
    // TEST 5: Standalone Test Recommendation by Doctor
    // ----------------------------------------------------
    console.log('\n--- 6. Standalone Diagnostic Test Recommendation ---');

    const recRes = await request(
      server,
      'POST',
      '/api/v1/medical/reports/recommend',
      {
        patientId: patientUser._id.toString(),
        appointmentId: testAppointment._id.toString(),
        testName: 'Serum Ferritin & Iron Studies',
        category: 'Other'
      },
      doctorToken
    );
    assert(recRes.status === 201, 'POST /api/v1/medical/reports/recommend returns 201 Created');
    assert(recRes.data?.data?.status === 'recommended', 'Created test report has status "recommended"');
    assert(recRes.data?.data?.testName === 'Serum Ferritin & Iron Studies', 'Test name is stored accurately');

    // ----------------------------------------------------
    // TEST 6: Diagnostic Report File Upload & Streaming
    // ----------------------------------------------------
    console.log('\n--- 7. Diagnostic Report Secure Upload & Private Streaming ---');

    // Patient uploads a diagnostic report PDF
    const dummyPdfContent = Buffer.from('%PDF-1.4\n%VitaLink Simulated Diagnostic Lab Report\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

    const uploadRes = await uploadMultipart(
      server,
      'POST',
      `/api/v1/medical/reports/${createdTestReportId}/upload`,
      'report',
      'cbc_lab_result.pdf',
      dummyPdfContent,
      'application/pdf',
      patientToken
    );

    assert(uploadRes.status === 200, 'POST /api/v1/medical/reports/:id/upload returns 200 OK');
    assert(uploadRes.data?.data?.status === 'uploaded', 'Report status updated to "uploaded"');
    assert(
      uploadRes.data?.data?.reportFileUrl === `/api/v1/medical/reports/${createdTestReportId}/file`,
      'Report file URL is an authenticated streaming endpoint, NOT a public static URL'
    );

    // Auto-created MedicalRecord for the uploaded report
    const reportMedicalRecord = await MedicalRecord.findOne({
      patient: patientUser._id,
      recordType: 'test_report'
    });
    assert(!!reportMedicalRecord, 'AUTO-SYNC: MedicalRecord of type "test_report" was created upon file upload');

    // Other patient cannot upload to this report
    const otherPatUpload = await uploadMultipart(
      server,
      'POST',
      `/api/v1/medical/reports/${createdTestReportId}/upload`,
      'report',
      'malicious.pdf',
      dummyPdfContent,
      'application/pdf',
      otherPatientToken
    );
    assert(otherPatUpload.status === 403, 'SECURITY: Unrelated patient cannot upload document to another patient’s report (403)');

    // ----------------------------------------------------
    // TEST 7: Authenticated Report File Streaming
    // ----------------------------------------------------
    console.log('\n--- 8. Authenticated Report File Streaming ---');

    // Patient owner downloads report file
    const streamRes = await requestBinary(
      server,
      `/api/v1/medical/reports/${createdTestReportId}/file`,
      patientToken
    );
    assert(streamRes.status === 200, 'Patient owner can securely stream report file (200)');
    assert(
      streamRes.data.toString().includes('VitaLink Simulated Diagnostic Lab Report'),
      'Streamed binary content matches uploaded document'
    );

    // Consulting doctor downloads report file
    const docStreamRes = await requestBinary(
      server,
      `/api/v1/medical/reports/${createdTestReportId}/file`,
      doctorToken
    );
    assert(docStreamRes.status === 200, 'Authorized doctor can securely stream patient report file (200)');

    // Unrelated patient blocked from streaming file
    const unauthStreamRes = await requestBinary(
      server,
      `/api/v1/medical/reports/${createdTestReportId}/file`,
      otherPatientToken
    );
    assert(unauthStreamRes.status === 403, 'DATA PRIVACY: Unrelated patient denied file stream (403 FORBIDDEN)');

    // Unauthenticated request blocked
    const anonStreamRes = await requestBinary(
      server,
      `/api/v1/medical/reports/${createdTestReportId}/file`,
      null
    );
    assert(anonStreamRes.status === 401, 'SECURITY: Unauthenticated file download returns 401 AUTH_TOKEN_MISSING');

    // ----------------------------------------------------
    // TEST 8: Doctor Reviews Diagnostic Report
    // ----------------------------------------------------
    console.log('\n--- 9. Doctor Report Review & Status Progression ---');

    const reviewRes = await request(
      server,
      'PATCH',
      `/api/v1/medical/reports/${createdTestReportId}/review`,
      {
        findings: 'Mild leukocytosis noted (WBC 11,500/mcL). Consistent with acute viral/bacterial bronchitis.',
        reviewedNotes: 'Prescription regimen appropriate. Patient advised to complete 5-day antibiotic course.'
      },
      doctorToken
    );

    assert(reviewRes.status === 200, 'PATCH /api/v1/medical/reports/:id/review returns 200 OK');
    assert(reviewRes.data?.data?.status === 'reviewed', 'Report status progressed to "reviewed"');
    assert(
      reviewRes.data?.data?.reviewedNotes?.includes('antibiotic course'),
      'Doctor clinical review notes saved accurately'
    );

    // Unrelated doctor cannot review report
    const unauthReview = await request(
      server,
      'PATCH',
      `/api/v1/medical/reports/${createdTestReportId}/review`,
      { reviewedNotes: 'Tampering notes' },
      otherDoctorToken
    );
    assert(unauthReview.status === 403, 'SECURITY: Doctor without interaction cannot review report (403)');

    // ----------------------------------------------------
    // TEST 9: Response Hygiene (No Passwords or Secrets)
    // ----------------------------------------------------
    console.log('\n--- 10. Security & Response Hygiene ---');

    const checkNoSecrets = (obj) => {
      const str = JSON.stringify(obj);
      return !str.includes('password') && !str.includes('JWT_SECRET') && !str.includes('HashedPassword');
    };

    assert(checkNoSecrets(createRxRes.data), 'Prescription responses contain no passwords or secrets');
    assert(checkNoSecrets(patRecordsRes.data), 'Medical record responses contain no passwords or secrets');
    assert(checkNoSecrets(reviewRes.data), 'Report review responses contain no passwords or secrets');

  } catch (err) {
    console.error('[Test Error]', err);
    failed++;
  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (doctorUser?._id) await User.deleteOne({ _id: doctorUser._id });
      if (otherDoctorUser?._id) await User.deleteOne({ _id: otherDoctorUser._id });
      if (patientUser?._id) await User.deleteOne({ _id: patientUser._id });
      if (otherPatientUser?._id) await User.deleteOne({ _id: otherPatientUser._id });
      if (shippingUser?._id) await User.deleteOne({ _id: shippingUser._id });
      if (testAppointment?._id) await Appointment.deleteOne({ _id: testAppointment._id });
      if (createdPrescriptionId) await Prescription.deleteOne({ _id: createdPrescriptionId });
      await MedicalRecord.deleteMany({ patient: patientUser?._id });
      await TestReport.deleteMany({ patient: patientUser?._id });
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();
    await disconnectDB();

    console.log('\n====================================================');
    console.log(`Phase 7 Tests Complete: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runPhase7Tests();
