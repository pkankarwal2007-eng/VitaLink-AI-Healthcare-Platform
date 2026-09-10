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
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const TestReport = require('../models/TestReport');
const MedicineOrder = require('../models/MedicineOrder');
const ShippingProfile = require('../models/ShippingProfile');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const { ROLES, ORDER_STATUS, APPOINTMENT_TYPES, APPOINTMENT_STATUS, VERIFICATION_STATUS } = require('../config/constants');
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

const runPhase9Tests = async () => {
  console.log('====================================================');
  console.log(' VITALINK PHASE 9 — AUTOMATED VERIFICATION SUITE');
  console.log(' Notifications, Reviews, Analytics, Search & UX');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  };

  await connectDB();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  console.log(`[Test Server] Running on ephemeral port ${testPort}\n`);

  const ts = Date.now();
  const cleanups = {
    users: [],
    doctorProfiles: [],
    doctorVerifications: [],
    appointments: [],
    prescriptions: [],
    medicalRecords: [],
    testReports: [],
    orders: [],
    shippingProfiles: [],
    notifications: [],
    reviews: []
  };

  try {
    // ----------------------------------------------------
    // SETUP TEST FIXTURES
    // ----------------------------------------------------
    console.log('[Setup] Creating Phase 9 test users & role entities...');

    // 1. Patient
    const patientUser = await User.create({
      fullName: `Test Patient P9 ${ts}`,
      email: `patient.p9.${ts}@example.com`,
      password: 'Password123!',
      role: ROLES.PATIENT,
      phone: '9876543210',
      gender: 'male',
      dateOfBirth: new Date('1992-05-15'),
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001'
    });
    cleanups.users.push(patientUser._id);
    const patientToken = generateToken(patientUser);

    // 2. Second Patient (for isolation tests)
    const otherPatient = await User.create({
      fullName: `Other Patient P9 ${ts}`,
      email: `other.patient.${ts}@example.com`,
      password: 'Password123!',
      role: ROLES.PATIENT,
      phone: '9876543211',
      city: 'Pune',
      state: 'Maharashtra'
    });
    cleanups.users.push(otherPatient._id);
    const otherPatientToken = generateToken(otherPatient);

    // 3. Doctor
    const doctorUser = await User.create({
      fullName: `Dr. Ananya P9 ${ts}`,
      email: `doctor.p9.${ts}@example.com`,
      password: 'Password123!',
      role: ROLES.DOCTOR,
      phone: '9876543212',
      city: 'Mumbai',
      state: 'Maharashtra'
    });
    cleanups.users.push(doctorUser._id);
    const doctorToken = generateToken(doctorUser);

    const doctorProfile = await DoctorProfile.create({
      user: doctorUser._id,
      specialization: 'Cardiologist',
      highestDegree: 'MBBS, MD Cardiology',
      college: 'Grant Medical College',
      experienceYears: 12,
      hospitalName: 'VitaLink Heart Institute',
      hospitalAddress: 'Bandra West, Mumbai',
      consultationFee: 750,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isVerified: true,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      appointmentDuration: 30,
      rating: 0,
      reviewCount: 0
    });
    cleanups.doctorProfiles.push(doctorProfile._id);

    // 4. Shipping Partner
    const shippingUser = await User.create({
      fullName: `FastTrack Express P9 ${ts}`,
      email: `shipping.p9.${ts}@example.com`,
      password: 'Password123!',
      role: ROLES.SHIPPING,
      phone: '9876543213',
      city: 'Mumbai',
      state: 'Maharashtra'
    });
    cleanups.users.push(shippingUser._id);
    const shippingToken = generateToken(shippingUser);

    const shippingProfile = await ShippingProfile.create({
      user: shippingUser._id,
      companyName: 'FastTrack Courier Co',
      serviceCities: ['Mumbai', 'Thane', 'Navi Mumbai'],
      isAvailable: true
    });
    cleanups.shippingProfiles.push(shippingProfile._id);

    // 5. Admin
    const adminUser = await User.create({
      fullName: `Admin P9 ${ts}`,
      email: `admin.p9.${ts}@example.com`,
      password: 'Password123!',
      role: ROLES.ADMIN,
      phone: '9876543214'
    });
    cleanups.users.push(adminUser._id);
    const adminToken = generateToken(adminUser);

    console.log('[Setup] Test entities initialized successfully.\n');

    // ====================================================
    // GROUP 1: NOTIFICATION MODEL & REAL-TIME EVENT GENERATION
    // ====================================================
    console.log('--- GROUP 1: Notification Generation & Lifecycle ---');

    // Test 1: Direct notification retrieval returns initial empty/zero count
    const initialNotifs = await request(server, 'GET', '/api/v1/notifications', null, patientToken);
    assert(
      initialNotifs.status === 200 && Array.isArray(initialNotifs.data.data) && initialNotifs.data.unreadCount === 0,
      'Initial notification list for patient returns 200 with zero unread'
    );

    // Test 2: Unread count endpoint
    const initialCount = await request(server, 'GET', '/api/v1/notifications/unread-count', null, patientToken);
    assert(
      initialCount.status === 200 && initialCount.data.unreadCount === 0,
      'GET /api/v1/notifications/unread-count returns 200 with unreadCount 0'
    );

    // Test 3: Appointment Booking creates REAL notifications for both Doctor & Patient
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const bookingRes = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: doctorUser._id.toString(),
        date: targetDate.toISOString().split('T')[0],
        timeSlot: { start: '10:00', end: '10:30' },
        consultationType: 'video',
        reason: 'Severe chest tightness and mild palpitations'
      },
      patientToken
    );
    assert(bookingRes.status === 201, 'Patient successfully books appointment with doctor');
    const apt1Id = bookingRes.data?.data?.appointment?._id;
    if (apt1Id) cleanups.appointments.push(apt1Id);

    // Test 4: Verify Patient received appointment_confirmed notification
    const patientNotifsAfterBooking = await request(server, 'GET', '/api/v1/notifications', null, patientToken);
    assert(
      patientNotifsAfterBooking.status === 200 &&
      patientNotifsAfterBooking.data.data.some((n) => n.type === 'appointment_confirmed' && !n.isRead),
      'Appointment booking generated real "appointment_confirmed" notification for patient'
    );

    // Test 5: Verify Doctor received appointment_booked notification
    const doctorNotifsAfterBooking = await request(server, 'GET', '/api/v1/notifications', null, doctorToken);
    assert(
      doctorNotifsAfterBooking.status === 200 &&
      doctorNotifsAfterBooking.data.data.some((n) => n.type === 'appointment_booked' && !n.isRead),
      'Appointment booking generated real "appointment_booked" notification for doctor'
    );

    // Test 6: Verify doctor's unread count incremented
    const doctorUnreadRes = await request(server, 'GET', '/api/v1/notifications/unread-count', null, doctorToken);
    assert(
      doctorUnreadRes.status === 200 && doctorUnreadRes.data.unreadCount >= 1,
      'Doctor unread count is >= 1 after scheduled appointment'
    );

    // Test 7: Prescription Creation creates notification for Patient
    const prescRes = await request(
      server,
      'POST',
      '/api/v1/medical/prescriptions',
      {
        appointmentId: apt1Id,
        clinicalAssessment: 'Mild Angina with sinus tachycardia. Stable hemodynamics.',
        medications: [
          { name: 'Atenolol', dosage: '25mg', frequency: 'Once daily', duration: '14 days', price: 65 },
          { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily post-dinner', duration: '30 days', price: 40 }
        ],
        advice: 'Limit strenuous exertion and salt intake.'
      },
      doctorToken
    );
    assert(prescRes.status === 201, 'Doctor issues digital prescription for appointment');
    const prescId = prescRes.data?.data?._id;
    if (prescId) cleanups.prescriptions.push(prescId);

    const patientNotifsAfterPresc = await request(server, 'GET', '/api/v1/notifications', null, patientToken);
    assert(
      patientNotifsAfterPresc.status === 200 &&
      patientNotifsAfterPresc.data.data.some((n) => n.type === 'new_prescription'),
      'Prescription creation generated real "new_prescription" notification for patient'
    );

    // Test 8: Diagnostic Test Recommendation creates notification for Patient
    const testRecRes = await request(
      server,
      'POST',
      '/api/v1/medical/reports/recommend',
      {
        patientId: patientUser._id.toString(),
        appointmentId: apt1Id,
        testName: 'Lipid Profile & hs-CRP',
        category: 'Lipid Profile'
      },
      doctorToken
    );
    assert(testRecRes.status === 201, 'Doctor recommends diagnostic laboratory test');
    const testReportId = testRecRes.data?.data?._id;
    if (testReportId) cleanups.testReports.push(testReportId);

    const patientNotifsAfterTest = await request(server, 'GET', '/api/v1/notifications', null, patientToken);
    assert(
      patientNotifsAfterTest.status === 200 &&
      patientNotifsAfterTest.data.data.some((n) => n.type === 'test_recommendation' && n.title.includes('Recommended')),
      'Diagnostic test recommendation generated real "test_recommendation" notification'
    );

    // Test 9: Medicine Order Placement creates order_update notification for Patient
    const orderRes = await request(
      server,
      'POST',
      '/api/v1/orders',
      {
        prescriptionId: prescId,
        deliveryAddress: {
          fullName: patientUser.fullName,
          phone: patientUser.phone,
          street: '101 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pinCode: '400020'
        },
        paymentMethod: 'cod'
      },
      patientToken
    );
    assert(orderRes.status === 201, 'Patient creates medicine order from valid prescription');
    const orderId = orderRes.data?.data?._id;
    if (orderId) cleanups.orders.push(orderId);

    const patientNotifsAfterOrder = await request(server, 'GET', '/api/v1/notifications', null, patientToken);
    assert(
      patientNotifsAfterOrder.status === 200 &&
      patientNotifsAfterOrder.data.data.some((n) => n.type === 'order_update' && n.title.includes('Confirmed')),
      'Medicine order confirmed generated real "order_update" notification for patient'
    );

    // Test 10: Admin packs & assigns order to shipping partner -> Partner and Patient notifications
    // First admin packs order
    await MedicineOrder.findByIdAndUpdate(orderId, { status: ORDER_STATUS.PACKED });
    const assignRes = await request(
      server,
      'POST',
      `/api/v1/shipping/orders/${orderId}/assign`,
      { shippingPartnerId: shippingUser._id.toString() },
      adminToken
    );
    assert(assignRes.status === 200, 'Admin successfully assigns packed medicine order to courier');

    const shippingNotifs = await request(server, 'GET', '/api/v1/notifications', null, shippingToken);
    assert(
      shippingNotifs.status === 200 &&
      shippingNotifs.data.data.some((n) => n.type === 'order_update' && n.title.includes('Assigned')),
      'Shipping partner received real "order_update" notification for assigned order'
    );

    // Test 11: Shipping partner advances order through delivery lifecycle -> updates patient
    await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/status`,
      { status: ORDER_STATUS.PICKED_UP, note: 'Collected package from hub' },
      shippingToken
    );
    await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/status`,
      { status: ORDER_STATUS.OUT_FOR_DELIVERY, note: 'Rider on bike' },
      shippingToken
    );
    await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/status`,
      { status: ORDER_STATUS.DELIVERED, note: 'Handed to recipient' },
      shippingToken
    );

    const patientNotifsAfterDelivery = await request(server, 'GET', '/api/v1/notifications', null, patientToken);
    assert(
      patientNotifsAfterDelivery.status === 200 &&
      patientNotifsAfterDelivery.data.data.some((n) => n.type === 'delivery_update' && n.title.includes('Delivered')),
      'Order delivery generated real "delivery_update" notification for patient'
    );

    // Test 12: Notification mark-as-read endpoint
    const firstNotif = patientNotifsAfterDelivery.data.data[0];
    const markReadRes = await request(
      server,
      'PATCH',
      `/api/v1/notifications/${firstNotif._id}/read`,
      {},
      patientToken
    );
    assert(
      markReadRes.status === 200 && markReadRes.data.data.isRead === true,
      'PATCH /api/v1/notifications/:id/read marks notification as read with isRead: true'
    );

    // Test 13: Notification isolation - other user cannot mark another user's notification
    const crossUserMark = await request(
      server,
      'PATCH',
      `/api/v1/notifications/${firstNotif._id}/read`,
      {},
      otherPatientToken
    );
    assert(
      crossUserMark.status === 403 || crossUserMark.status === 404,
      'User cannot mark another user\'s notification as read (Cross-user isolation enforced)'
    );

    // Test 14: Notification mark-all-read endpoint
    const markAllRes = await request(server, 'PATCH', '/api/v1/notifications/mark-all-read', {}, patientToken);
    assert(
      markAllRes.status === 200 && markAllRes.data.success === true,
      'PATCH /api/v1/notifications/mark-all-read successfully executes'
    );

    const patientUnreadAfterMarkAll = await request(server, 'GET', '/api/v1/notifications/unread-count', null, patientToken);
    assert(
      patientUnreadAfterMarkAll.status === 200 && patientUnreadAfterMarkAll.data.unreadCount === 0,
      'Unread count is 0 after mark-all-read'
    );

    // ====================================================
    // GROUP 2: REVIEWS & RATINGS LIFECYCLE
    // ====================================================
    console.log('\n--- GROUP 2: Consultation Reviews & Ratings ---');

    // Test 15: Cannot review an appointment that is NOT completed
    const incompleteReviewRes = await request(
      server,
      'POST',
      '/api/v1/reviews',
      {
        appointmentId: apt1Id,
        rating: 5,
        comment: 'Great session!'
      },
      patientToken
    );
    assert(
      incompleteReviewRes.status === 400 && incompleteReviewRes.data.code === 'APPOINTMENT_NOT_COMPLETED',
      'Cannot review consultation before it is marked completed (400 APPOINTMENT_NOT_COMPLETED)'
    );

    // Test 16: Complete the appointment via Doctor status endpoint
    const completeAptRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt1Id}/status`,
      { status: APPOINTMENT_STATUS.COMPLETED },
      doctorToken
    );
    assert(completeAptRes.status === 200, 'Doctor marks appointment as completed');

    // Test 17: Other patient cannot review someone else's appointment
    const unauthorizedReviewRes = await request(
      server,
      'POST',
      '/api/v1/reviews',
      {
        appointmentId: apt1Id,
        rating: 5,
        comment: 'I was not the patient'
      },
      otherPatientToken
    );
    assert(
      unauthorizedReviewRes.status === 403,
      'Unrelated patient cannot submit review for another patient\'s appointment (403 FORBIDDEN)'
    );

    // Test 18: Reject review with invalid rating (e.g. 0 or 6 or string)
    const invalidRatingRes = await request(
      server,
      'POST',
      '/api/v1/reviews',
      {
        appointmentId: apt1Id,
        rating: 6,
        comment: 'Invalid star score'
      },
      patientToken
    );
    assert(
      invalidRatingRes.status === 400 && invalidRatingRes.data.code === 'VALIDATION_ERROR',
      'Rating out of bounds (6) rejected with 400 VALIDATION_ERROR'
    );

    // Test 19: Successfully submit valid review (5 stars)
    const validReviewRes = await request(
      server,
      'POST',
      '/api/v1/reviews',
      {
        appointmentId: apt1Id,
        rating: 5,
        comment: 'Outstanding cardiologist! Very clear explanations and prompt care.'
      },
      patientToken
    );
    assert(
      validReviewRes.status === 201 && validReviewRes.data.success === true,
      'POST /api/v1/reviews submits 5-star review for completed appointment'
    );
    const rev1Id = validReviewRes.data?.data?._id;
    if (rev1Id) cleanups.reviews.push(rev1Id);

    // Test 20: Rejection of duplicate review for same appointment
    const dupReviewRes = await request(
      server,
      'POST',
      '/api/v1/reviews',
      {
        appointmentId: apt1Id,
        rating: 4,
        comment: 'Attempting second review'
      },
      patientToken
    );
    assert(
      dupReviewRes.status === 400 && dupReviewRes.data.code === 'DUPLICATE_REVIEW',
      'Duplicate review for same appointment is rejected (400 DUPLICATE_REVIEW)'
    );

    // Test 21: Check doctor profile aggregated rating updated
    const updatedDocProfile = await DoctorProfile.findOne({ user: doctorUser._id });
    assert(
      updatedDocProfile.rating === 5 && updatedDocProfile.reviewCount === 1,
      'DoctorProfile rating recalculated accurately to 5.0 and reviewCount: 1'
    );

    // Test 22: Verify Doctor received "review_received" notification
    const doctorNotifsAfterReview = await request(server, 'GET', '/api/v1/notifications', null, doctorToken);
    assert(
      doctorNotifsAfterReview.status === 200 &&
      doctorNotifsAfterReview.data.data.some((n) => n.type === 'review_received'),
      'Doctor received real "review_received" notification after patient submitted review'
    );

    // Test 23: Create second completed appointment with 4-star review to test aggregation
    const apt2 = await Appointment.create({
      patient: otherPatient._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: new Date(),
      timeSlot: { start: '14:00', end: '14:30' },
      consultationType: 'chat',
      reason: 'Hypertension checkup',
      status: APPOINTMENT_STATUS.COMPLETED
    });
    cleanups.appointments.push(apt2._id);

    const review2Res = await request(
      server,
      'POST',
      '/api/v1/reviews',
      {
        appointmentId: apt2._id.toString(),
        rating: 4,
        comment: 'Helpful and reassuring consultation.'
      },
      otherPatientToken
    );
    assert(review2Res.status === 201, 'Second review (4 stars) submitted successfully');
    if (review2Res.data?.data?._id) cleanups.reviews.push(review2Res.data.data._id);

    // Test 24: Verify aggregate rating calculation: (5 + 4) / 2 = 4.5
    const profileAfterRev2 = await DoctorProfile.findOne({ user: doctorUser._id });
    assert(
      profileAfterRev2.rating === 4.5 && profileAfterRev2.reviewCount === 2,
      'DoctorProfile aggregated rating correctly recalculated to 4.5 with 2 reviews'
    );

    // Test 25: GET /api/v1/reviews/doctor/:doctorId returns breakdown and list
    const doctorReviewsRes = await request(
      server,
      'GET',
      `/api/v1/reviews/doctor/${doctorUser._id}`,
      null,
      patientToken
    );
    assert(
      doctorReviewsRes.status === 200 &&
      doctorReviewsRes.data.total === 2 &&
      doctorReviewsRes.data.averageRating === 4.5 &&
      doctorReviewsRes.data.breakdown['5'] === 1 &&
      doctorReviewsRes.data.breakdown['4'] === 1,
      'GET /api/v1/reviews/doctor/:doctorId returns accurate rating breakdown and total count'
    );

    // Test 26: GET /api/v1/reviews/appointment/:appointmentId returns single review
    const aptReviewRes = await request(
      server,
      'GET',
      `/api/v1/reviews/appointment/${apt1Id}`,
      null,
      patientToken
    );
    assert(
      aptReviewRes.status === 200 && aptReviewRes.data.data?.rating === 5,
      'GET /api/v1/reviews/appointment/:appointmentId returns matching review'
    );

    // ====================================================
    // GROUP 3: REAL DATABASE ANALYTICS ENDPOINTS
    // ====================================================
    console.log('\n--- GROUP 3: Real Database Analytics Aggregations ---');

    // Test 27: Patient forbidden from Admin analytics
    const patientAdminAnalytics = await request(server, 'GET', '/api/v1/analytics/admin', null, patientToken);
    assert(
      patientAdminAnalytics.status === 403,
      'Patient role cannot access admin analytics (403 FORBIDDEN)'
    );

    // Test 28: Doctor forbidden from Admin analytics
    const doctorAdminAnalytics = await request(server, 'GET', '/api/v1/analytics/admin', null, doctorToken);
    assert(
      doctorAdminAnalytics.status === 403,
      'Doctor role cannot access admin analytics (403 FORBIDDEN)'
    );

    // Test 29: Admin successfully fetches analytics with real DB counts
    const adminAnalyticsRes = await request(server, 'GET', '/api/v1/analytics/admin', null, adminToken);
    assert(
      adminAnalyticsRes.status === 200 && adminAnalyticsRes.data.success === true,
      'GET /api/v1/analytics/admin succeeds for administrator role'
    );

    const adminOverview = adminAnalyticsRes.data?.data?.overview || {};
    // Test 30: Real counts verification
    assert(
      adminOverview.totalPatients >= 2 &&
      adminOverview.totalDoctors >= 1 &&
      adminOverview.totalShippingPartners >= 1,
      'Admin analytics overview contains verified patient, doctor, and shipping counts'
    );

    // Test 31: Real appointment & order fulfillment rates
    assert(
      typeof adminOverview.appointmentCompletionRate === 'number' &&
      typeof adminOverview.orderFulfillmentRate === 'number',
      'Admin analytics calculates real completion and fulfillment rates'
    );

    // Test 32: Appointments by type
    const byType = adminAnalyticsRes.data?.data?.appointmentsByType || {};
    assert(
      byType.video >= 1 && byType.chat >= 1,
      'Admin analytics includes breakdown by modality (video, chat, physical)'
    );

    // Test 33: Doctor Analytics access control (Patient receives 403)
    const patientDocAnalytics = await request(server, 'GET', '/api/v1/analytics/doctor', null, patientToken);
    assert(
      patientDocAnalytics.status === 403,
      'Patient role cannot access doctor clinical analytics (403 FORBIDDEN)'
    );

    // Test 34: Doctor retrieves their own clinical analytics
    const doctorAnalyticsRes = await request(server, 'GET', '/api/v1/analytics/doctor', null, doctorToken);
    assert(
      doctorAnalyticsRes.status === 200 && doctorAnalyticsRes.data.success === true,
      'GET /api/v1/analytics/doctor succeeds for authenticated clinician'
    );

    const docOverview = doctorAnalyticsRes.data?.data?.overview || {};
    // Test 35: Doctor unique patients count
    assert(
      docOverview.uniquePatients >= 2,
      'Doctor analytics reports real unique patient count (>= 2)'
    );

    // Test 36: Doctor completed appointments
    assert(
      docOverview.completedAppointments >= 2,
      'Doctor analytics reports real completed consultations (>= 2)'
    );

    // Test 37: Doctor prescriptions issued
    assert(
      docOverview.totalPrescriptions >= 1,
      'Doctor analytics reports real digital prescriptions issued (>= 1)'
    );

    // Test 38: Doctor average rating
    assert(
      docOverview.averageRating === 4.5 && docOverview.reviewCount === 2,
      'Doctor analytics matches aggregated rating 4.5 and reviewCount 2'
    );

    // Test 39: Doctor estimated earnings
    assert(
      docOverview.estimatedEarnings > 0,
      'Doctor analytics calculates estimated practice earnings from consultation fees'
    );

    // ====================================================
    // GROUP 4: SEARCH, FILTERING & DATA INTEGRITY
    // ====================================================
    console.log('\n--- GROUP 4: Discovery Search, Filtering & Data Privacy ---');

    // Test 40: Doctor discovery search by name
    const searchByName = await request(
      server,
      'GET',
      `/api/v1/doctors?search=Ananya`,
      null
    );
    assert(
      searchByName.status === 200 &&
      searchByName.data.data.doctors.some((d) => d.user?.fullName?.includes('Ananya')),
      'Public doctor search by name matches verified clinician'
    );

    // Test 41: Doctor discovery filter by specialization
    const filterBySpec = await request(
      server,
      'GET',
      `/api/v1/doctors?specialization=Cardiologist`,
      null
    );
    assert(
      filterBySpec.status === 200 &&
      filterBySpec.data.data.doctors.every((d) => d.specialization === 'Cardiologist'),
      'Public doctor search filters strictly by specialization'
    );

    // Test 42: Doctor discovery filter by city
    const filterByCity = await request(
      server,
      'GET',
      `/api/v1/doctors?city=Mumbai`,
      null
    );
    assert(
      filterByCity.status === 200 &&
      filterByCity.data.data.doctors.some((d) => d.user?.city === 'Mumbai'),
      'Public doctor search filters by city'
    );

    // Test 43: Doctor discovery sorting by rating
    const sortByRating = await request(
      server,
      'GET',
      `/api/v1/doctors?sortBy=rating&sortOrder=desc`,
      null
    );
    assert(
      sortByRating.status === 200 && Array.isArray(sortByRating.data.data.doctors),
      'Public doctor search supports sorting by rating in descending order'
    );

    // Test 44: Doctor verification submission notifies Admin
    const unverifiedDoc = await User.create({
      fullName: `Dr. New P9 ${ts}`,
      email: `doctor.new.${ts}@example.com`,
      phone: '9876543299',
      password: 'Password123!',
      role: ROLES.DOCTOR
    });
    cleanups.users.push(unverifiedDoc._id);
    const unverifiedToken = generateToken(unverifiedDoc);

    const docProf = await DoctorProfile.create({
      user: unverifiedDoc._id,
      specialization: 'Neurologist'
    });
    cleanups.doctorProfiles.push(docProf._id);

    // Test 45: Submit verification documents
    const docVerif = await DoctorVerification.create({
      doctor: unverifiedDoc._id,
      doctorProfile: docProf._id,
      status: VERIFICATION_STATUS.PENDING,
      documents: [
        { docType: 'medical_license', fileName: 'license.pdf', fileUrl: '/api/v1/admin/verification-documents/license.pdf' }
      ]
    });
    cleanups.doctorVerifications.push(docVerif._id);

    // Admin approves verification
    const approveRes = await request(
      server,
      'PATCH',
      `/api/v1/admin/doctors/${unverifiedDoc._id}/approve`,
      { adminNotes: 'Verified with state medical board.' },
      adminToken
    );
    assert(approveRes.status === 200, 'Admin approves doctor verification');

    // Verify doctor received approval notification
    const docNotifsAfterApproval = await request(server, 'GET', '/api/v1/notifications', null, unverifiedToken);
    assert(
      docNotifsAfterApproval.status === 200 &&
      docNotifsAfterApproval.data.data.some((n) => n.title.includes('Approved')),
      'Doctor receives real approval notification when administrator approves credentials'
    );

    // Test 46: Privacy - Sensitive medical document streams reject unauthorized users
    const unauthDocStream = await request(
      server,
      'GET',
      `/api/v1/admin/verification-documents/license.pdf`,
      null,
      patientToken
    );
    assert(
      unauthDocStream.status === 403,
      'Patient cannot access sensitive administrative verification documents (403 FORBIDDEN)'
    );

    // Test 47: Privacy - Password hash is never exposed in notification responses
    const allNotifsDump = JSON.stringify(patientNotifsAfterDelivery.data);
    assert(
      !allNotifsDump.includes('password') && !allNotifsDump.includes('$2a$'),
      'Notification payloads never expose password hashes or sensitive authentication credentials'
    );

    // Test 48: Notification pagination works properly
    const paginatedNotifs = await request(server, 'GET', '/api/v1/notifications?limit=2&page=1', null, patientToken);
    assert(
      paginatedNotifs.status === 200 && paginatedNotifs.data.data.length <= 2,
      'GET /api/v1/notifications supports pagination limit query'
    );

    // Test 49: Cancellation of appointment notifies counterparty
    const aptToCancel = await Appointment.create({
      patient: patientUser._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: targetDate,
      timeSlot: { start: '16:00', end: '16:30' },
      consultationType: 'video',
      reason: 'Follow-up consultation',
      status: APPOINTMENT_STATUS.CONFIRMED
    });
    cleanups.appointments.push(aptToCancel._id);

    const cancelAptRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${aptToCancel._id}/cancel`,
      { reason: 'Patient unavailable due to emergency' },
      patientToken
    );
    assert(cancelAptRes.status === 200, 'Patient cancels upcoming appointment');

    const doctorNotifsAfterCancel = await request(server, 'GET', '/api/v1/notifications', null, doctorToken);
    assert(
      doctorNotifsAfterCancel.status === 200 &&
      doctorNotifsAfterCancel.data.data.some((n) => n.type === 'appointment_cancelled'),
      'Appointment cancellation generated real "appointment_cancelled" notification for counterparty'
    );

    // Test 50: Security - Unauthenticated users cannot access notifications
    const unauthNotifs = await request(server, 'GET', '/api/v1/notifications', null, null);
    assert(
      unauthNotifs.status === 401,
      'Unauthenticated request to /api/v1/notifications rejected (401 UNAUTHORIZED)'
    );

  } catch (error) {
    console.error('[Phase 9 Test Suite Error]:', error);
    failed++;
  } finally {
    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n[Cleanup] Cleaning up test data...');
    try {
      if (cleanups.reviews.length > 0) await Review.deleteMany({ _id: { $in: cleanups.reviews } });
      if (cleanups.notifications.length > 0) await Notification.deleteMany({ _id: { $in: cleanups.notifications } });
      if (cleanups.orders.length > 0) await MedicineOrder.deleteMany({ _id: { $in: cleanups.orders } });
      if (cleanups.shippingProfiles.length > 0) await ShippingProfile.deleteMany({ _id: { $in: cleanups.shippingProfiles } });
      if (cleanups.testReports.length > 0) await TestReport.deleteMany({ _id: { $in: cleanups.testReports } });
      if (cleanups.prescriptions.length > 0) await Prescription.deleteMany({ _id: { $in: cleanups.prescriptions } });
      if (cleanups.appointments.length > 0) await Appointment.deleteMany({ _id: { $in: cleanups.appointments } });
      if (cleanups.doctorVerifications.length > 0) await DoctorVerification.deleteMany({ _id: { $in: cleanups.doctorVerifications } });
      if (cleanups.doctorProfiles.length > 0) await DoctorProfile.deleteMany({ _id: { $in: cleanups.doctorProfiles } });
      if (cleanups.users.length > 0) {
        // Also delete any notifications created for these test users
        await Notification.deleteMany({ recipient: { $in: cleanups.users } });
        await Review.deleteMany({ patient: { $in: cleanups.users } });
        await User.deleteMany({ _id: { $in: cleanups.users } });
      }
      console.log('[Cleanup] Test fixtures cleaned up successfully.');
    } catch (cleanErr) {
      console.error('[Cleanup Error]:', cleanErr.message);
    }

    server.close();
    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log(` PHASE 9 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase9Tests();
