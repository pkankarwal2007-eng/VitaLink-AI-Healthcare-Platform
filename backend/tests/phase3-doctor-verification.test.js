const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const DoctorVerification = require('../models/DoctorVerification');
const AuditLog = require('../models/AuditLog');
const { ROLES, VERIFICATION_STATUS } = require('../config/constants');
const { generateToken } = require('../utils/jwt');

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

const runPhase3Tests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Phase 3 Doctor Verification Tests       ');
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
  const doctorEmail = `phase3.doctor.${ts}@example.com`;
  const patientEmail = `phase3.patient.${ts}@example.com`;
  const adminEmail = `phase3.admin.${ts}@example.com`;

  try {
    // 1. Setup Doctor Account
    const docReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Dr. Ananya Sen',
      email: doctorEmail,
      phone: '9871112233',
      gender: 'female',
      password: 'DoctorPassword123!',
      confirmPassword: 'DoctorPassword123!',
      role: 'doctor'
    });
    const doctorToken = docReg.data?.data?.token;
    const doctorUserId = docReg.data?.data?.user?._id;
    assert(docReg.status === 201 && !!doctorToken, 'Doctor registered successfully');

    // Setup Patient Account (for unauthorized tests)
    const patReg = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Siddharth Roy',
      email: patientEmail,
      phone: '9872223344',
      password: 'PatientPassword123!',
      confirmPassword: 'PatientPassword123!',
      role: 'patient'
    });
    const patientToken = patReg.data?.data?.token;

    // Setup Admin Account in DB
    const adminUser = await User.create({
      fullName: 'Lead Platform Compliance Officer',
      email: adminEmail,
      phone: '9873334455',
      password: 'AdminPassword123!',
      role: ROLES.ADMIN,
      isActive: true
    });
    const adminToken = generateToken(adminUser);

    // TEST 1: Doctor Profile Initial Retrieval
    console.log('\n--- 1. Doctor Profile Creation & Editing ---');
    const myProfileRes = await request(server, 'GET', '/api/v1/doctors/profile/me', null, doctorToken);
    assert(
      myProfileRes.status === 200 && myProfileRes.data?.success === true,
      'GET /api/v1/doctors/profile/me retrieves doctor profile'
    );
    assert(
      myProfileRes.data?.data?.profile?.isVerified === false,
      'Initial doctor status is unverified'
    );

    // TEST 2: Doctor Updates Clinical Credentials
    const updateProfileRes = await request(server, 'PUT', '/api/v1/doctors/profile', {
      medicalRegistrationNumber: 'MCI-889922',
      highestDegree: 'MBBS, MD',
      college: 'Grant Medical College Mumbai',
      graduationYear: 2014,
      experienceYears: 10,
      specialization: 'Cardiologist',
      skills: ['ECG', 'Heart Disease', 'Telemedicine'],
      hospitalName: 'Lilavati Hospital',
      hospitalAddress: 'Bandra West, Mumbai',
      consultationFee: 800,
      availableDays: ['Monday', 'Tuesday', 'Thursday'],
      about: 'Senior interventional cardiologist with 10 years experience.'
    }, doctorToken);

    assert(
      updateProfileRes.status === 200 && updateProfileRes.data?.data?.profile?.specialization === 'Cardiologist',
      'PUT /api/v1/doctors/profile updates clinical credentials successfully'
    );
    assert(
      updateProfileRes.data?.data?.profile?.consultationFee === 800,
      'Consultation fee updated to ₹800'
    );

    const doctorProfileId = updateProfileRes.data?.data?.profile?._id;

    // TEST 3: Submit Verification (programmatic creation for test)
    console.log('\n--- 2. Verification Submission & Status Transition ---');
    const verificationDoc = await DoctorVerification.create({
      doctor: doctorUserId,
      doctorProfile: doctorProfileId,
      status: VERIFICATION_STATUS.PENDING,
      documents: [
        { docType: 'degree_certificate', fileName: 'degree-test.pdf', fileUrl: '/api/v1/admin/verification-documents/degree-test.pdf' },
        { docType: 'medical_license', fileName: 'license-test.pdf', fileUrl: '/api/v1/admin/verification-documents/license-test.pdf' }
      ],
      submittedAt: new Date(),
      statusHistory: [{ status: VERIFICATION_STATUS.PENDING, reason: 'Initial submission' }]
    });
    await DoctorProfile.findByIdAndUpdate(doctorProfileId, { verificationStatus: VERIFICATION_STATUS.PENDING });

    assert(!!verificationDoc._id, 'Verification submission created in pending status');

    // TEST 4: Unapproved Doctor MUST NOT appear in Public Directory
    console.log('\n--- 3. Public Search Boundary: Unapproved Doctor Hidden ---');
    const publicListUnapproved = await request(server, 'GET', `/api/v1/doctors?specialization=Cardiologist`);
    assert(
      publicListUnapproved.status === 200,
      'GET /api/v1/doctors responds 200'
    );
    const foundUnapproved = (publicListUnapproved.data?.data?.doctors || []).some(
      (d) => d._id.toString() === doctorProfileId.toString()
    );
    assert(
      foundUnapproved === false,
      'SECURITY: Pending/unapproved doctor does NOT appear in public doctor directory'
    );

    // TEST 5: Direct profile detail access for unapproved doctor returns 404
    const directDetailUnapproved = await request(server, 'GET', `/api/v1/doctors/${doctorProfileId}`);
    assert(
      directDetailUnapproved.status === 404,
      'SECURITY: Direct GET /api/v1/doctors/:id returns 404 for unapproved doctor'
    );

    // TEST 6: Unauthorized Role Cannot Approve or Access Admin Endpoints
    console.log('\n--- 4. Role Authorization on Admin Actions ---');
    const patientApproveAttempt = await request(
      server,
      'PATCH',
      `/api/v1/admin/doctors/${doctorUserId}/approve`,
      { adminNotes: 'Hacker approval' },
      patientToken
    );
    assert(
      patientApproveAttempt.status === 403,
      'SECURITY: Patient token cannot call admin approve endpoint (403)'
    );

    const doctorSelfApproveAttempt = await request(
      server,
      'PATCH',
      `/api/v1/admin/doctors/${doctorUserId}/approve`,
      { adminNotes: 'Self approval attempt' },
      doctorToken
    );
    assert(
      doctorSelfApproveAttempt.status === 403,
      'SECURITY: Doctor token cannot self-approve credentials (403)'
    );

    // TEST 7: Unauthorized Sensitive Document Download Protection
    const docLeakAttempt = await request(
      server,
      'GET',
      '/api/v1/admin/verification-documents/license-test.pdf',
      null,
      patientToken
    );
    assert(
      docLeakAttempt.status === 403,
      'SECURITY: Non-admin token cannot access sensitive verification documents (403)'
    );

    // TEST 8: Admin Reviews Pending Queue
    console.log('\n--- 5. Admin Review & Approval Workflow ---');
    const pendingQueueRes = await request(server, 'GET', '/api/v1/admin/doctors/pending', null, adminToken);
    assert(
      pendingQueueRes.status === 200 && pendingQueueRes.data?.data?.count > 0,
      'Admin successfully retrieves pending doctor verification queue'
    );

    // TEST 9: Admin Approves Doctor
    const approveRes = await request(
      server,
      'PATCH',
      `/api/v1/admin/doctors/${doctorUserId}/approve`,
      { adminNotes: 'State medical license and MD credentials verified with Medical Council.' },
      adminToken
    );
    assert(
      approveRes.status === 200 && approveRes.data?.data?.doctor?.isVerified === true,
      'Admin approves doctor: isVerified set to true'
    );
    assert(
      approveRes.data?.data?.doctor?.verificationStatus === 'approved',
      'verificationStatus updated to "approved"'
    );

    // TEST 10: Audit Log Recorded
    const auditEntry = await AuditLog.findOne({
      action: 'DOCTOR_VERIFICATION_APPROVED',
      targetId: doctorUserId
    });
    assert(
      !!auditEntry && auditEntry.performedBy.toString() === adminUser._id.toString(),
      'AuditLog records DOCTOR_VERIFICATION_APPROVED with admin performer'
    );

    // TEST 11: Approved Doctor Appears in Public Directory
    console.log('\n--- 6. Public Visibility of Approved Doctors ---');
    const publicListApproved = await request(server, 'GET', `/api/v1/doctors?specialization=Cardiologist`);
    const foundApproved = (publicListApproved.data?.data?.doctors || []).some(
      (d) => d._id.toString() === doctorProfileId.toString()
    );
    assert(
      foundApproved === true,
      'Approved doctor now appears in public doctor directory'
    );

    // TEST 12: Public Doctor Detail Page Access
    const publicDetailApproved = await request(server, 'GET', `/api/v1/doctors/${doctorProfileId}`);
    assert(
      publicDetailApproved.status === 200 && publicDetailApproved.data?.data?.doctor?.isVerified === true,
      'Approved doctor detail endpoint returns public doctor data with verified status'
    );
    assert(
      publicDetailApproved.data?.data?.doctor?.medicalRegistrationNumber === undefined ||
      publicDetailApproved.data?.data?.doctor?.aadhaarCard === undefined,
      'Sensitive identity documents are NOT exposed on public doctor profile'
    );

    // TEST 13: Admin Suspends Doctor
    console.log('\n--- 7. Suspension Workflow & Instant De-listing ---');
    const suspendRes = await request(
      server,
      'PATCH',
      `/api/v1/admin/doctors/${doctorUserId}/suspend`,
      { reason: 'Routine license audit pending' },
      adminToken
    );
    assert(
      suspendRes.status === 200 && suspendRes.data?.data?.status === 'suspended',
      'Admin suspends doctor successfully'
    );

    // TEST 14: Suspended Doctor Immediately Disappears from Public Directory
    const publicListSuspended = await request(server, 'GET', `/api/v1/doctors?specialization=Cardiologist`);
    const foundSuspended = (publicListSuspended.data?.data?.doctors || []).some(
      (d) => d._id.toString() === doctorProfileId.toString()
    );
    assert(
      foundSuspended === false,
      'SECURITY: Suspended doctor is immediately hidden from public directory'
    );

    // TEST 15: Direct access returns 404 for suspended doctor
    const publicDetailSuspended = await request(server, 'GET', `/api/v1/doctors/${doctorProfileId}`);
    assert(
      publicDetailSuspended.status === 404,
      'SECURITY: Direct profile access returns 404 for suspended doctor'
    );

    // TEST 16: Admin Rejects Doctor Verification with Reason
    console.log('\n--- 8. Rejection Workflow ---');
    const rejectRes = await request(
      server,
      'PATCH',
      `/api/v1/admin/doctors/${doctorUserId}/reject`,
      { reason: 'Registration number not found on state council records' },
      adminToken
    );
    assert(
      rejectRes.status === 200 && rejectRes.data?.data?.status === 'rejected',
      'Admin rejects doctor verification with reason'
    );

    const rejectAudit = await AuditLog.findOne({
      action: 'DOCTOR_VERIFICATION_REJECTED',
      targetId: doctorUserId
    });
    assert(
      !!rejectAudit,
      'AuditLog records DOCTOR_VERIFICATION_REJECTED'
    );

    // Cleanup test records
    await User.deleteMany({
      email: { $in: [doctorEmail, patientEmail, adminEmail] }
    });
    await DoctorProfile.deleteMany({ user: doctorUserId });
    await DoctorVerification.deleteMany({ doctor: doctorUserId });
    await AuditLog.deleteMany({ targetId: doctorUserId });
    console.log('\n[Test Runner] Cleaned up temporary test data.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Runner] Ephemeral test server closed.');
    await disconnectDB();
  }

  console.log('====================================================');
  console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase3Tests().catch((err) => {
  console.error('[Phase 3 Fatal Error]:', err);
  process.exit(1);
});
