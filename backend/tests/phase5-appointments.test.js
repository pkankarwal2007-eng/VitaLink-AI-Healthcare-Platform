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
const Appointment = require('../models/Appointment');
const { ROLES, VERIFICATION_STATUS, APPOINTMENT_STATUS, APPOINTMENT_TYPES } = require('../config/constants');
const { generateToken } = require('../utils/jwt');
const { generateDoctorSlots, toMinutes, toTimeStr } = require('../services/slotService');

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

const runPhase5Tests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Phase 5 Doctor Discovery & Appointments ');
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

  // Ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Runner] Ephemeral test server active on port ${port}\n`);

  const timestamp = Date.now();
  const verifiedDocEmail = `verified_doc_${timestamp}@vitalink.com`;
  const unverifiedDocEmail = `unverified_doc_${timestamp}@vitalink.com`;
  const patientEmail1 = `patient_one_${timestamp}@vitalink.com`;
  const patientEmail2 = `patient_two_${timestamp}@vitalink.com`;

  let verifiedDocUser, unverifiedDocUser, patientUser1, patientUser2;
  let verifiedDocProfile, unverifiedDocProfile;
  let verifiedDocToken, patientToken1, patientToken2;

  try {
    // ----------------------------------------------------
    // Section 1: Setup Test Users & Doctor Profiles
    // ----------------------------------------------------
    console.log('--- Section 1: Test Setup & Discovery Preconditions ---');

    // 1. Verified Doctor
    verifiedDocUser = await User.create({
      fullName: 'Aarav Mehta',
      email: verifiedDocEmail,
      password: 'Password123!',
      phone: '9876540001',
      gender: 'male',
      dateOfBirth: new Date('1982-04-12'),
      address: '74 Apollo Clinic Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.DOCTOR,
      isActive: true
    });
    verifiedDocToken = generateToken(verifiedDocUser);

    verifiedDocProfile = await DoctorProfile.create({
      user: verifiedDocUser._id,
      specialization: 'Cardiologist',
      highestDegree: 'MD Cardiology',
      college: 'Grant Medical College',
      experienceYears: 12,
      hospitalName: 'Apollo Cardio Centre',
      hospitalAddress: 'Mumbai, Maharashtra',
      consultationFee: 750,
      availableDays: ['Monday', 'Wednesday', 'Friday'],
      availableTime: { start: '09:00', end: '13:00' },
      breakTime: { start: '11:00', end: '11:30' },
      appointmentDuration: 30,
      consultationModes: ['chat', 'video', 'physical'],
      rating: 4.9,
      totalReviews: 24,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isVerified: true
    });

    // 2. Unverified Doctor (Pending)
    unverifiedDocUser = await User.create({
      fullName: 'Vikram Sharma',
      email: unverifiedDocEmail,
      password: 'Password123!',
      phone: '9876540002',
      gender: 'male',
      dateOfBirth: new Date('1988-08-20'),
      address: '12 Ridge Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      role: ROLES.DOCTOR,
      isActive: true
    });

    unverifiedDocProfile = await DoctorProfile.create({
      user: unverifiedDocUser._id,
      specialization: 'Dermatologist',
      highestDegree: 'MBBS, DVD',
      college: 'BJ Medical College',
      experienceYears: 6,
      hospitalName: 'Skin Health Hospital',
      hospitalAddress: 'Pune, Maharashtra',
      consultationFee: 500,
      verificationStatus: VERIFICATION_STATUS.PENDING,
      isVerified: false
    });

    // 3. Patients
    patientUser1 = await User.create({
      fullName: 'Rahul Verma',
      email: patientEmail1,
      password: 'Password123!',
      phone: '9876540003',
      gender: 'male',
      dateOfBirth: new Date('1994-06-15'),
      address: '22 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400020',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken1 = generateToken(patientUser1);

    patientUser2 = await User.create({
      fullName: 'Priya Patel',
      email: patientEmail2,
      password: 'Password123!',
      phone: '9876540004',
      gender: 'female',
      dateOfBirth: new Date('1996-11-25'),
      address: '88 Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400050',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken2 = generateToken(patientUser2);

    assert(!!verifiedDocProfile && !!patientUser1 && !!patientUser2, 'Test users and profiles created successfully');

    // ----------------------------------------------------
    // Section 2: Public Doctor Discovery & Filtering
    // ----------------------------------------------------
    console.log('\n--- Section 2: Doctor Discovery & Verification Enforcement ---');

    // Test: Public listing strictly excludes unverified doctors
    const listRes = await request(server, 'GET', '/api/v1/doctors');
    assert(listRes.status === 200, 'GET /api/v1/doctors responds 200 OK');

    const listedDoctorIds = (listRes.data?.data?.doctors || []).map((d) => d._id.toString());
    assert(
      listedDoctorIds.includes(verifiedDocProfile._id.toString()),
      'Approved & verified doctor appears in public doctor directory'
    );
    assert(
      !listedDoctorIds.includes(unverifiedDocProfile._id.toString()),
      'Pending / unverified doctor is strictly excluded from public directory'
    );

    // Test: Search by doctor name
    const searchRes = await request(server, 'GET', '/api/v1/doctors?search=Aarav');
    assert(
      searchRes.status === 200 &&
      searchRes.data?.data?.doctors?.some((d) => d.user?.fullName?.includes('Aarav')),
      'Search by doctor name correctly finds matching practitioner'
    );

    // Test: Filter by specialization
    const specRes = await request(server, 'GET', '/api/v1/doctors?specialization=Cardiologist');
    assert(
      specRes.status === 200 &&
      specRes.data?.data?.doctors?.every((d) => d.specialization === 'Cardiologist'),
      'Filter by specialization returns exclusively Cardiologists'
    );

    // Test: Filter by city
    const cityRes = await request(server, 'GET', '/api/v1/doctors?city=Mumbai');
    assert(
      cityRes.status === 200 &&
      cityRes.data?.data?.doctors?.some((d) => d._id.toString() === verifiedDocProfile._id.toString()),
      'Filter by city returns doctors located in Mumbai'
    );

    // Test: Filter by consultation mode
    const modeRes = await request(server, 'GET', '/api/v1/doctors?consultationType=video');
    assert(
      modeRes.status === 200 &&
      modeRes.data?.data?.doctors?.every((d) => d.consultationModes?.includes('video')),
      'Filter by consultation mode returns doctors supporting video consultations'
    );

    // Test: Public doctor detail endpoint
    const detailRes = await request(server, 'GET', `/api/v1/doctors/${verifiedDocProfile._id}`);
    assert(
      detailRes.status === 200 && detailRes.data?.data?.doctor?._id.toString() === verifiedDocProfile._id.toString(),
      'GET /api/v1/doctors/:id retrieves verified doctor detail'
    );
    assert(
      !detailRes.data?.data?.doctor?.aadhaarCard && !detailRes.data?.data?.doctor?.documents,
      'Public doctor detail does not expose sensitive verification documents'
    );

    // ----------------------------------------------------
    // Section 3: Dynamic Availability Slot Generation
    // ----------------------------------------------------
    console.log('\n--- Section 3: Dynamic Availability Slot Generation ---');

    // Find next upcoming Monday for doctor (verifiedDoc works Mon, Wed, Fri)
    const getNextDayOfWeek = (dayIndex) => {
      const d = new Date();
      d.setDate(d.getDate() + ((dayIndex + 7 - d.getDay()) % 7 || 7));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const nextMonday = getNextDayOfWeek(1); // 1 = Monday
    const nextTuesday = getNextDayOfWeek(2); // 2 = Tuesday (non-working day)

    // Test: Slots generated on working day (Monday)
    const slotsMonRes = await request(server, 'GET', `/api/v1/doctors/${verifiedDocProfile._id}/slots?date=${nextMonday}`);
    assert(slotsMonRes.status === 200, 'GET /api/v1/doctors/:id/slots returns 200 OK');
    assert(slotsMonRes.data?.data?.isWorkingDay === true, 'Monday is correctly marked as a working day');

    const slotsMon = slotsMonRes.data?.data?.slots || [];
    assert(slotsMon.length > 0, 'Generates dynamic appointment slots for working day');

    // Verify break time (11:00 to 11:30) is omitted
    const hasBreakSlot = slotsMon.some((s) => s.start === '11:00');
    assert(!hasBreakSlot, 'Slots overlapping with doctor break time (11:00-11:30) are excluded');

    // Test: Slots on non-working day (Tuesday)
    const slotsTueRes = await request(server, 'GET', `/api/v1/doctors/${verifiedDocProfile._id}/slots?date=${nextTuesday}`);
    assert(
      slotsTueRes.status === 200 && slotsTueRes.data?.data?.isWorkingDay === false && slotsTueRes.data?.data?.slots?.length === 0,
      'Non-working day (Tuesday) yields isWorkingDay: false with empty slot array'
    );

    // ----------------------------------------------------
    // Section 4: Appointment Booking & Validation
    // ----------------------------------------------------
    console.log('\n--- Section 4: Appointment Booking & Validation ---');

    // Test: Unauthenticated booking fails
    const unauthBooking = await request(server, 'POST', '/api/v1/appointments', {
      doctorId: verifiedDocProfile._id,
      date: nextMonday,
      timeSlot: { start: '09:00', end: '09:30' },
      reason: 'Chest discomfort'
    });
    assert(unauthBooking.status === 401, 'Unauthenticated appointment booking returns 401 Unauthorized');

    // Test: Doctor attempting to book returns 403 (patient only)
    const docAsPatientBooking = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: verifiedDocProfile._id,
        date: nextMonday,
        timeSlot: { start: '09:00', end: '09:30' },
        reason: 'Consultation'
      },
      verifiedDocToken
    );
    assert(docAsPatientBooking.status === 403, 'Doctor role cannot book appointments (403 Forbidden)');

    // Test: Booking past date fails
    const pastBooking = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: verifiedDocProfile._id,
        date: '2020-01-01',
        timeSlot: { start: '09:00', end: '09:30' },
        reason: 'Back pain'
      },
      patientToken1
    );
    assert(
      pastBooking.status === 400 && pastBooking.data?.code === 'PAST_DATE_NOT_ALLOWED',
      'Booking appointment on a past date is rejected with 400 PAST_DATE_NOT_ALLOWED'
    );

    // Test: Booking on non-working day fails
    const nonWorkingDayBooking = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: verifiedDocProfile._id,
        date: nextTuesday,
        timeSlot: { start: '09:00', end: '09:30' },
        reason: 'Regular checkup'
      },
      patientToken1
    );
    assert(
      nonWorkingDayBooking.status === 400 && nonWorkingDayBooking.data?.code === 'DOCTOR_UNAVAILABLE_DAY',
      'Booking on doctor non-working day is rejected with 400 DOCTOR_UNAVAILABLE_DAY'
    );

    // Test: Successful appointment booking by Patient 1
    const validBookingRes = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: verifiedDocProfile._id,
        date: nextMonday,
        timeSlot: { start: '09:30', end: '10:00' },
        consultationType: APPOINTMENT_TYPES.VIDEO,
        reason: 'Periodic cardiovascular evaluation'
      },
      patientToken1
    );

    assert(
      validBookingRes.status === 201 && validBookingRes.data?.success === true,
      'Patient 1 successfully books appointment (201 Created)'
    );

    const bookedAppointment = validBookingRes.data?.data?.appointment;
    assert(
      bookedAppointment?.status === APPOINTMENT_STATUS.PENDING &&
      bookedAppointment?.fee === 750 &&
      bookedAppointment?.videoRoomId?.startsWith('vitalink-room-'),
      'Booked appointment receives PENDING status, correct fee, and videoRoomId'
    );

    // ----------------------------------------------------
    // Section 5: Double-Booking & Overlapping Guard
    // ----------------------------------------------------
    console.log('\n--- Section 5: Double-Booking & Concurrency Protection ---');

    // Test: Patient 2 attempts to book the EXACT SAME slot (09:30 - 10:00 on nextMonday)
    const duplicateSlotBooking = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: verifiedDocProfile._id,
        date: nextMonday,
        timeSlot: { start: '09:30', end: '10:00' },
        consultationType: APPOINTMENT_TYPES.VIDEO,
        reason: 'Second patient trying to take same slot'
      },
      patientToken2
    );

    assert(
      duplicateSlotBooking.status === 409 && duplicateSlotBooking.data?.code === 'SLOT_ALREADY_BOOKED',
      'Double-booking same doctor and slot is rejected with 409 SLOT_ALREADY_BOOKED'
    );

    // Test: Slot generator reflects the booked slot as unavailable
    const updatedSlotsRes = await request(server, 'GET', `/api/v1/doctors/${verifiedDocProfile._id}/slots?date=${nextMonday}`);
    const slot930 = (updatedSlotsRes.data?.data?.slots || []).find((s) => s.start === '09:30');
    assert(
      slot930?.isBooked === true && slot930?.isAvailable === false,
      'Slot generator dynamically marks booked slot (09:30) as isBooked: true and isAvailable: false'
    );

    // ----------------------------------------------------
    // Section 6: Appointment Retrieval & Access Control
    // ----------------------------------------------------
    console.log('\n--- Section 6: Retrieval & Role-Based Access Control ---');

    // Test: Patient 1 retrieves their appointments
    const patientAptsRes = await request(server, 'GET', '/api/v1/appointments/my', null, patientToken1);
    assert(
      patientAptsRes.status === 200 &&
      patientAptsRes.data?.data?.some((a) => a._id.toString() === bookedAppointment._id.toString()),
      'Patient 1 retrieves list containing their booked appointment'
    );

    // Test: Doctor retrieves assigned consultations
    const doctorAptsRes = await request(server, 'GET', '/api/v1/appointments/my', null, verifiedDocToken);
    assert(
      doctorAptsRes.status === 200 &&
      doctorAptsRes.data?.data?.some((a) => a._id.toString() === bookedAppointment._id.toString()),
      'Doctor retrieves list containing consultation booked with them'
    );

    // Test: Patient 2 attempts to view Patient 1 appointment (access control)
    const unauthorizedGetRes = await request(
      server,
      'GET',
      `/api/v1/appointments/${bookedAppointment._id}`,
      null,
      patientToken2
    );
    assert(
      unauthorizedGetRes.status === 403,
      'Patient 2 cannot access Patient 1 appointment detail (403 Forbidden)'
    );

    // ----------------------------------------------------
    // Section 7: Status Lifecycle & Slot Freeing upon Cancellation
    // ----------------------------------------------------
    console.log('\n--- Section 7: Status Updates & Slot Freeing Cancellation ---');

    // Test: Doctor accepts the pending appointment
    const acceptRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${bookedAppointment._id}/accept`,
      {},
      verifiedDocToken
    );
    const acceptedStatus = acceptRes.data?.data?.appointment?.status || acceptRes.data?.data?.status;
    assert(
      acceptRes.status === 200 && acceptedStatus === APPOINTMENT_STATUS.CONFIRMED,
      'Doctor accepts pending appointment (status transitions to CONFIRMED)'
    );

    // Test: Doctor updates status to completed
    const completeRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${bookedAppointment._id}/status`,
      { status: APPOINTMENT_STATUS.COMPLETED },
      verifiedDocToken
    );
    assert(
      completeRes.status === 200 && completeRes.data?.data?.status === APPOINTMENT_STATUS.COMPLETED,
      'Doctor updates appointment status to COMPLETED'
    );

    // Book a second appointment to test cancellation
    const booking2 = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: verifiedDocProfile._id,
        date: nextMonday,
        timeSlot: { start: '10:00', end: '10:30' },
        consultationType: APPOINTMENT_TYPES.CHAT,
        reason: 'Follow-up query'
      },
      patientToken1
    );
    assert(booking2.status === 201, 'Patient 1 schedules second appointment for 10:00');
    const apt2Id = booking2.data?.data?.appointment?._id;

    // Test: Patient cancels the appointment
    const cancelRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt2Id}/cancel`,
      { reason: 'Schedule conflict on Monday morning' },
      patientToken1
    );
    assert(
      cancelRes.status === 200 && cancelRes.data?.data?.status === APPOINTMENT_STATUS.CANCELLED,
      'Patient cancels appointment (status transitions to CANCELLED)'
    );

    // Verify slot 10:00 is freed up again
    const postCancelSlotsRes = await request(server, 'GET', `/api/v1/doctors/${verifiedDocProfile._id}/slots?date=${nextMonday}`);
    const slot1000 = (postCancelSlotsRes.data?.data?.slots || []).find((s) => s.start === '10:00');
    assert(
      slot1000?.isBooked === false && slot1000?.isAvailable === true,
      'Cancelled appointment slot (10:00) is freed up and immediately available for booking again'
    );

    // ----------------------------------------------------
    // Section 8: Security & Secret Redaction
    // ----------------------------------------------------
    console.log('\n--- Section 8: Security & Secrets Redaction ---');

    const detailString = JSON.stringify(detailRes.data || {});
    const bookingString = JSON.stringify(validBookingRes.data || {});

    assert(
      !detailString.includes('MONGO_URI') &&
      !detailString.includes('JWT_SECRET') &&
      !bookingString.includes('MONGO_URI') &&
      !bookingString.includes('password'),
      'No secret credentials or database strings are exposed in appointment or discovery responses'
    );

    // Cleanup test data
    await User.deleteMany({
      email: { $in: [verifiedDocEmail, unverifiedDocEmail, patientEmail1, patientEmail2] }
    });
    await DoctorProfile.deleteMany({
      _id: { $in: [verifiedDocProfile._id, unverifiedDocProfile._id] }
    });
    await Appointment.deleteMany({
      _id: { $in: [bookedAppointment._id, apt2Id] }
    });
    console.log('\n[Test Runner] Cleaned up temporary test data.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Runner] Ephemeral test server closed.');
    await disconnectDB();
  }

  console.log('====================================================');
  console.log(`Phase 5 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase5Tests().catch((err) => {
  console.error('[Phase 5 Fatal Error]:', err);
  process.exit(1);
});
