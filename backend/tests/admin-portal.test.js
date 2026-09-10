process.env.NODE_ENV = 'test';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const DoctorVerification = require('../models/DoctorVerification');
const AuditLog = require('../models/AuditLog');
const ContactMessage = require('../models/ContactMessage');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const { ROLES, VERIFICATION_STATUS, APPOINTMENT_STATUS } = require('../config/constants');
const { generateToken } = require('../utils/jwt');

const request = (server, method, reqPath, data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close'
      },
      agent: false
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

const runAdminPortalTests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Admin Portal & RBAC Verification Tests   ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${description}`);
      failed++;
    }
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const ts = Date.now();

  const adminEmail = `test.admin.${ts}@example.com`;
  const patientEmail = `test.patient.${ts}@example.com`;
  const doctorEmail = `test.doctor.${ts}@example.com`;
  const shippingEmail = `test.shipping.${ts}@example.com`;

  let adminUser, patientUser, doctorUser, shippingUser;
  let adminToken, patientToken, doctorToken, shippingToken;
  let testDoctorProfile, testVerification;

  try {
    console.log('--- 1. Security & RBAC Preconditions ---');

    // Attempt public registration with role=admin -> MUST FAIL 403
    const adminRegAttempt = await request(server, 'POST', '/api/v1/auth/register', {
      fullName: 'Injected Admin',
      email: `evil.admin.${ts}@example.com`,
      phone: '9870000000',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      role: 'admin'
    });
    assert(adminRegAttempt.status === 403, 'Public registration rejects role="admin" with 403 Forbidden');

    // Create Patient fixture
    console.log('[Test Setup] Creating patient fixture...');
    patientUser = await User.create({
      fullName: 'Test Patient',
      email: patientEmail,
      phone: '9871111111',
      password: 'PatientPassword123!',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken = generateToken(patientUser);
    assert(patientUser.role === 'patient', 'Patient account verified with role="patient"');

    // Create Doctor fixture
    console.log('[Test Setup] Creating doctor fixture...');
    doctorUser = await User.create({
      fullName: 'Dr. Test Candidate',
      email: doctorEmail,
      phone: '9872222222',
      password: 'DoctorPassword123!',
      role: ROLES.DOCTOR,
      isActive: true
    });
    doctorToken = generateToken(doctorUser);
    testDoctorProfile = await DoctorProfile.create({
      user: doctorUser._id,
      specialization: 'Cardiologist',
      highestDegree: 'MBBS, MD',
      isVerified: false,
      verificationStatus: VERIFICATION_STATUS.PENDING
    });
    assert(doctorUser.role === 'doctor', 'Doctor account verified with role="doctor"');

    // Create Shipping Partner fixture
    console.log('[Test Setup] Creating shipping fixture...');
    shippingUser = await User.create({
      fullName: 'Speedy Logistics',
      email: shippingEmail,
      phone: '9873333333',
      password: 'ShippingPassword123!',
      role: ROLES.SHIPPING,
      isActive: true
    });
    shippingToken = generateToken(shippingUser);
    assert(shippingUser.role === 'shipping', 'Shipping partner verified with role="shipping"');

    // Create Authorized Administrator fixture
    console.log('[Test Setup] Creating admin fixture...');
    adminUser = await User.create({
      fullName: 'Platform Administrator',
      email: adminEmail,
      phone: '9874444444',
      password: 'AdminPassword123!',
      role: ROLES.ADMIN,
      isActive: true,
      isEmailVerified: true
    });
    adminToken = generateToken(adminUser);
    assert(adminUser.role === 'admin', 'Admin account verified with role="admin"');

    console.log('\n--- 2. Unified /login Authentication Workflow ---');
    // Test normal login endpoint for admin
    const adminLoginRes = await request(server, 'POST', '/api/v1/auth/login', {
      email: adminEmail,
      password: 'AdminPassword123!'
    });
    assert(adminLoginRes.status === 200, 'POST /api/v1/auth/login authenticates admin credentials successfully (200)');
    assert(adminLoginRes.data?.data?.user?.role === 'admin', 'Returned user object has role="admin" for redirection to /admin');
    assert(!adminLoginRes.data?.data?.user?.password, 'Password hash is strictly excluded from login response');

    console.log('\n--- 3. Backend RBAC Enforcement on Admin APIs ---');
    // Patient attempting Admin API -> 403
    const patAdminAttempt = await request(server, 'GET', '/api/v1/admin/users', null, patientToken);
    assert(patAdminAttempt.status === 403, 'Patient cannot access GET /api/v1/admin/users (403 Forbidden)');

    // Doctor attempting Admin API -> 403
    const docAdminAttempt = await request(server, 'GET', '/api/v1/admin/users', null, doctorToken);
    assert(docAdminAttempt.status === 403, 'Doctor cannot access GET /api/v1/admin/users (403 Forbidden)');

    // Shipping user attempting Admin API -> 403
    const shipAdminAttempt = await request(server, 'GET', '/api/v1/admin/users', null, shippingToken);
    assert(shipAdminAttempt.status === 403, 'Shipping partner cannot access GET /api/v1/admin/users (403 Forbidden)');

    // Unauthenticated request -> 401
    const unauthAttempt = await request(server, 'GET', '/api/v1/admin/users');
    assert(unauthAttempt.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

    // Admin accessing Admin API -> 200
    const adminUsersRes = await request(server, 'GET', '/api/v1/admin/users', null, adminToken);
    assert(adminUsersRes.status === 200, 'Admin successfully accesses GET /api/v1/admin/users (200 OK)');
    assert(Array.isArray(adminUsersRes.data?.data?.users), 'Users API returns array of platform accounts');

    console.log('\n--- 4. Doctor Verification Workflow & Public Visibility Boundary ---');
    // Unapproved doctor does NOT appear in public doctor directory
    const publicDocList = await request(server, 'GET', '/api/v1/doctors');
    const doctorInPublic = publicDocList.data?.data?.doctors?.some(d => d._id?.toString() === testDoctorProfile?._id?.toString());
    assert(doctorInPublic === false, 'Unapproved doctor strictly excluded from public doctor directory');

    // Doctor submits verification
    testVerification = await DoctorVerification.create({
      doctor: doctorUser._id,
      doctorProfile: testDoctorProfile._id,
      status: VERIFICATION_STATUS.PENDING,
      documents: [
        {
          docType: 'medical_license',
          fileName: 'license-specimen.pdf',
          fileUrl: '/api/v1/admin/verification-documents/license-specimen.pdf'
        }
      ]
    });

    // Admin views pending verifications queue
    const pendingQueueRes = await request(server, 'GET', '/api/v1/admin/doctors/pending', null, adminToken);
    assert(pendingQueueRes.status === 200, 'Admin retrieves pending doctor verification queue (200 OK)');
    assert(pendingQueueRes.data?.data?.verifications?.length > 0, 'Pending verification appears in admin verification queue');

    // Admin requests changes
    const changeReq = await request(server, 'PATCH', `/api/v1/admin/doctors/${doctorUser._id}/request-changes`, {
      notes: 'Please upload updated council registration'
    }, adminToken);
    assert(changeReq.status === 200, 'Admin successfully requests changes from doctor (200 OK)');
    const auditChange = await AuditLog.findOne({ action: 'DOCTOR_CHANGES_REQUESTED', targetId: doctorUser._id });
    assert(!!auditChange, 'Audit log accurately recorded DOCTOR_CHANGES_REQUESTED event');

    // Admin approves doctor
    const approveRes = await request(server, 'PATCH', `/api/v1/admin/doctors/${doctorUser._id}/approve`, {
      adminNotes: 'All clinical credentials certified'
    }, adminToken);
    assert(approveRes.status === 200, 'Admin approves and verifies doctor (200 OK)');

    const updatedProfile = await DoctorProfile.findById(testDoctorProfile._id);
    assert(updatedProfile.isVerified === true, 'Doctor isVerified updated to true');
    assert(updatedProfile.verificationStatus === VERIFICATION_STATUS.APPROVED, 'Doctor verificationStatus updated to "approved"');

    // Approved doctor now appears in public doctor directory
    const publicDocsAfter = await request(server, 'GET', '/api/v1/doctors');
    const doctorNowPublic = publicDocsAfter.data?.data?.doctors?.some(d => d._id?.toString() === testDoctorProfile?._id?.toString());
    assert(doctorNowPublic === true, 'Approved & verified doctor is now publicly discoverable');

    console.log('\n--- 5. Admin Dashboard 14 Domain APIs ---');
    // Overview & Analytics
    const analyticsRes = await request(server, 'GET', '/api/v1/analytics/admin', null, adminToken);
    assert(analyticsRes.status === 200 && !!analyticsRes.data?.data?.overview, 'Domain 1: Admin Overview & Analytics API functional');

    // Appointments Oversight
    const appRes = await request(server, 'GET', '/api/v1/admin/appointments', null, adminToken);
    assert(appRes.status === 200 && Array.isArray(appRes.data?.data?.appointments), 'Domain 4: Admin Appointments oversight API functional');

    // Prescriptions Oversight
    const rxRes = await request(server, 'GET', '/api/v1/admin/prescriptions', null, adminToken);
    assert(rxRes.status === 200 && Array.isArray(rxRes.data?.data?.prescriptions), 'Domain 5: Prescriptions oversight API functional');

    // Medical Records Oversight
    const recRes = await request(server, 'GET', '/api/v1/admin/records', null, adminToken);
    assert(recRes.status === 200 && Array.isArray(recRes.data?.data?.records), 'Domain 6: Medical Records oversight API functional');

    // Diagnostic Reports Oversight
    const repRes = await request(server, 'GET', '/api/v1/admin/reports', null, adminToken);
    assert(repRes.status === 200 && Array.isArray(repRes.data?.data?.reports), 'Domain 7: Diagnostic Reports oversight API functional');

    // Medicine Orders Oversight
    const ordRes = await request(server, 'GET', '/api/v1/admin/orders', null, adminToken);
    assert(ordRes.status === 200 && Array.isArray(ordRes.data?.data?.orders), 'Domain 8: Medicine Orders oversight API functional');

    // Shipping Partners Fleet
    const shipFleetRes = await request(server, 'GET', '/api/v1/admin/shipping-partners', null, adminToken);
    assert(shipFleetRes.status === 200 && Array.isArray(shipFleetRes.data?.data?.partners), 'Domain 9: Shipping Partners Fleet API functional');

    // System Notifications & Broadcast
    const notifRes = await request(server, 'GET', '/api/v1/admin/notifications', null, adminToken);
    assert(notifRes.status === 200, 'Domain 10: System Notifications history API functional');

    const broadcastRes = await request(server, 'POST', '/api/v1/admin/notifications/broadcast', {
      title: 'Platform System Alert',
      message: 'Routine maintenance test announcement',
      targetRole: 'all',
      link: '/'
    }, adminToken);
    assert(broadcastRes.status === 200, 'Domain 10: Broadcast Notification API successfully dispatches announcement');

    // Reviews Moderation
    const revRes = await request(server, 'GET', '/api/v1/admin/reviews', null, adminToken);
    assert(revRes.status === 200 && Array.isArray(revRes.data?.data?.reviews), 'Domain 11: Reviews Moderation API functional');

    // Contact Inquiries (from Landing Page to Admin Inbox)
    const contactPost = await request(server, 'POST', '/api/v1/contact', {
      name: 'Care Seeker',
      email: 'care@example.com',
      subject: 'Inquiry',
      message: 'Need help with appointment schedule'
    });
    assert(contactPost.status === 201, 'Public contact form POST /api/v1/contact accepts inquiries');

    const contactInbox = await request(server, 'GET', '/api/v1/admin/contact-messages', null, adminToken);
    assert(contactInbox.status === 200 && contactInbox.data?.data?.messages?.length > 0, 'Domain 12: Contact Inquiries Admin Inbox receives messages');

    // Compliance Audit Logs
    const auditRes = await request(server, 'GET', '/api/v1/admin/audit-logs', null, adminToken);
    assert(auditRes.status === 200 && auditRes.data?.data?.logs?.length > 0, 'Domain 13: Compliance Audit Logs API functional');

    // System Status & Diagnostics
    const sysStatus = await request(server, 'GET', '/api/v1/admin/system-status', null, adminToken);
    assert(sysStatus.status === 200 && sysStatus.data?.data?.database?.status === 'Connected', 'Domain 14: System Status & Diagnostic API functional');

    console.log('\n--- 6. User Status Toggle & Self-Protection ---');
    // Admin toggles patient active status
    const togglePat = await request(server, 'PATCH', `/api/v1/admin/users/${patientUser._id}/status`, null, adminToken);
    assert(togglePat.status === 200, 'Admin can toggle patient active status');

    // Admin attempts to deactivate own account -> MUST FAIL
    const selfDeactivate = await request(server, 'PATCH', `/api/v1/admin/users/${adminUser._id}/status`, null, adminToken);
    assert(selfDeactivate.status === 400, 'Administrative security boundary prevents admin from self-deactivating account');

  } catch (err) {
    console.error('  ✗ [ERROR] Unexpected test execution error:', err.message);
    failed++;
  } finally {
    // Cleanup temporary test records
    console.log('\n[Cleanup] Cleaning up temporary test users and verification records...');
    await User.deleteMany({ email: { $in: [adminEmail, patientEmail, doctorEmail, shippingEmail] } });
    if (testDoctorProfile) await DoctorProfile.findByIdAndDelete(testDoctorProfile._id);
    if (testVerification) await DoctorVerification.findByIdAndDelete(testVerification._id);
    await ContactMessage.deleteMany({ email: 'care@example.com' });
    await AuditLog.deleteMany({ performedBy: adminUser?._id });

    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log(` ADMIN PORTAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed === 0 ? 0 : 1);
};

runAdminPortalTests().catch((err) => {
  console.error('[Admin Portal Test Runner Error]:', err.message);
  process.exit(1);
});
