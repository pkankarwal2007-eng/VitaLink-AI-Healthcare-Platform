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
const Notification = require('../models/Notification');
const { ROLES, VERIFICATION_STATUS, APPOINTMENT_STATUS, APPOINTMENT_TYPES } = require('../config/constants');
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

const runWorkflowTests = async () => {
  console.log('================================================================');
  console.log('   VitaLink Upgraded Appointment Workflow End-to-End Test Suite ');
  console.log('================================================================\n');

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
  const docEmail = `workflow_doc_${ts}@vitalink.com`;
  const patientEmail = `workflow_patient_${ts}@vitalink.com`;
  const otherPatientEmail = `workflow_patient2_${ts}@vitalink.com`;

  let docUser, patientUser, otherPatientUser;
  let docProfile;
  let docToken, patientToken, otherPatientToken;

  try {
    // ----------------------------------------------------
    // Section 1: Preconditions & Setup
    // ----------------------------------------------------
    console.log('--- Section 1: Preconditions & Users Setup ---');

    docUser = await User.create({
      fullName: 'Dr. Sarah Jenkins',
      email: docEmail,
      password: 'Password123!',
      phone: '9876543210',
      gender: 'female',
      dateOfBirth: new Date('1984-06-15'),
      address: '742 Evergreen Terrace',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.DOCTOR,
      isActive: true
    });
    docToken = generateToken(docUser);

    docProfile = await DoctorProfile.create({
      user: docUser._id,
      specialization: 'Cardiologist',
      medicalRegistrationNumber: `MCI-${ts}`,
      consultationFee: 750,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      breakTime: { start: '13:00', end: '14:00' },
      appointmentDuration: 30,
      consultationModes: ['chat', 'video'],
      isVerified: true,
      verificationStatus: VERIFICATION_STATUS.APPROVED
    });

    patientUser = await User.create({
      fullName: 'Rahul Verma',
      email: patientEmail,
      password: 'Password123!',
      phone: '9876543211',
      gender: 'male',
      dateOfBirth: new Date('1996-04-12'),
      address: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400020',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken = generateToken(patientUser);

    otherPatientUser = await User.create({
      fullName: 'Anita Sharma',
      email: otherPatientEmail,
      password: 'Password123!',
      phone: '9876543212',
      gender: 'female',
      dateOfBirth: new Date('1994-08-20'),
      address: '45 Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400050',
      role: ROLES.PATIENT,
      isActive: true
    });
    otherPatientToken = generateToken(otherPatientUser);

    assert(Boolean(docProfile._id && patientToken), 'Doctor and Patient accounts created successfully');

    // Helper: calculate next Monday, next Tuesday, next Wednesday in YYYY-MM-DD
    const getNextDayOfWeek = (dayOfWeek) => {
      const d = new Date();
      const currentDay = d.getDay();
      let diff = (dayOfWeek + 7 - currentDay) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const nextMonday = getNextDayOfWeek(1);
    const nextTuesday = getNextDayOfWeek(2);
    const nextWednesday = getNextDayOfWeek(3);

    // ----------------------------------------------------
    // Section 2: Patient Books Appointment -> Status PENDING
    // ----------------------------------------------------
    console.log('\n--- Section 2: Booking -> PENDING Status ---');

    const bookRes1 = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: docProfile._id,
        date: nextMonday,
        timeSlot: { start: '10:00', end: '10:30' },
        consultationType: APPOINTMENT_TYPES.VIDEO,
        reason: 'General cardiology consultation'
      },
      patientToken
    );

    assert(bookRes1.status === 201, 'Appointment 1 created with status 201');
    const apt1 = bookRes1.data?.data?.appointment;
    assert(apt1?.status === APPOINTMENT_STATUS.PENDING, 'New appointment default status is PENDING');

    // Slot 10:00 should be marked booked/unavailable for another patient
    const conflictRes = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: docProfile._id,
        date: nextMonday,
        timeSlot: { start: '10:00', end: '10:30' },
        consultationType: APPOINTMENT_TYPES.VIDEO,
        reason: 'Conflict test'
      },
      otherPatientToken
    );
    assert(conflictRes.status === 409, 'Slot is locked while PENDING; duplicate booking rejected with 409');

    // ----------------------------------------------------
    // Section 3: Consultation Guard on PENDING Appointment
    // ----------------------------------------------------
    console.log('\n--- Section 3: Guard on PENDING Appointment (Chat & Video) ---');

    const chatMsgRes = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${apt1._id}`,
      { message: 'Hello doctor, are you available?' },
      patientToken
    );
    assert(
      chatMsgRes.status === 400 && chatMsgRes.data?.code === 'APPOINTMENT_AWAITING_CONFIRMATION',
      'Chat message blocked on PENDING appointment (400 APPOINTMENT_AWAITING_CONFIRMATION)'
    );

    const videoAuthRes = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${apt1._id}/auth`,
      null,
      patientToken
    );
    assert(
      videoAuthRes.status === 400 && videoAuthRes.data?.code === 'APPOINTMENT_NOT_ACTIVE',
      'Video room access blocked on PENDING appointment (400 APPOINTMENT_NOT_ACTIVE)'
    );

    // ----------------------------------------------------
    // Section 4: Doctor Schedule View & Slot States
    // ----------------------------------------------------
    console.log('\n--- Section 4: Doctor Schedule View ---');

    const scheduleRes = await request(
      server,
      'GET',
      `/api/v1/appointments/schedule/view?date=${nextMonday}`,
      null,
      docToken
    );
    assert(scheduleRes.status === 200, 'Doctor successfully views day schedule (200 OK)');
    const slots = scheduleRes.data?.data?.slots || [];
    const slot1000 = slots.find((s) => s.start === '10:00');
    assert(slot1000?.state === 'PENDING', 'Doctor schedule marks slot 10:00 as PENDING');
    assert(slot1000?.appointment?.patient?.fullName === 'Rahul Verma', 'Schedule slot includes patient details');

    const breakSlot = slots.find((s) => s.start === '13:00');
    assert(breakSlot?.state === 'BREAK', 'Doctor schedule marks 13:00 break slot as BREAK');

    // ----------------------------------------------------
    // Section 5: Doctor Rejects Appointment -> Status REJECTED & Slot Freed
    // ----------------------------------------------------
    console.log('\n--- Section 5: Doctor Rejection & Slot Freeing ---');

    const rejectRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt1._id}/reject`,
      { reason: 'Emergency cardiac surgery scheduled at this time' },
      docToken
    );
    assert(rejectRes.status === 200, 'Doctor successfully rejects appointment (200 OK)');
    const rejectedApt = rejectRes.data?.data?.appointment;
    assert(rejectedApt?.status === APPOINTMENT_STATUS.REJECTED, 'Appointment status transitioned to REJECTED');
    assert(
      rejectedApt?.rejectionReason === 'Emergency cardiac surgery scheduled at this time',
      'Rejection reason properly recorded'
    );

    // Slot 10:00 should now be free again
    const rebookRes = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: docProfile._id,
        date: nextMonday,
        timeSlot: { start: '10:00', end: '10:30' },
        consultationType: APPOINTMENT_TYPES.CHAT,
        reason: 'Re-booking freed slot'
      },
      otherPatientToken
    );
    assert(rebookRes.status === 201, 'Freed slot can be successfully booked by another patient (201 Created)');
    const apt2 = rebookRes.data?.data?.appointment;

    // ----------------------------------------------------
    // Section 6: Doctor Suggests Another Time
    // ----------------------------------------------------
    console.log('\n--- Section 6: Doctor Suggests Alternative Time ---');

    const suggestRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt2._id}/suggest-time`,
      {
        date: nextTuesday,
        timeSlot: { start: '11:00', end: '11:30' },
        reason: 'Dr. Sarah has ward rounds on Monday morning; proposing Tuesday 11:00 AM'
      },
      docToken
    );
    assert(suggestRes.status === 200, 'Doctor successfully suggests another time (200 OK)');
    const suggestedApt = suggestRes.data?.data?.appointment;
    assert(suggestedApt?.status === APPOINTMENT_STATUS.SUGGESTED_TIME, 'Status transitioned to SUGGESTED_TIME');
    assert(
      suggestedApt?.suggestedTimeSlot?.start === '11:00' &&
      suggestedApt?.suggestionReason?.includes('ward rounds'),
      'Suggested date, time slot, and reason accurately recorded'
    );

    // Check notification was sent to patient
    const patientNotifs = await Notification.find({
      recipient: otherPatientUser._id,
      type: 'appointment_time_suggested'
    });
    assert(patientNotifs.length > 0, 'Patient received appointment_time_suggested notification');

    // ----------------------------------------------------
    // Section 7: Patient Declines Suggested Time -> Status DECLINED
    // ----------------------------------------------------
    console.log('\n--- Section 7: Patient Declines Proposed Time ---');

    const declineRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt2._id}/patient-decline`,
      { reason: 'Tuesday 11:00 AM does not work with my office schedule' },
      otherPatientToken
    );
    assert(declineRes.status === 200, 'Patient successfully declines suggested time (200 OK)');
    const declinedApt = declineRes.data?.data?.appointment;
    assert(declinedApt?.status === APPOINTMENT_STATUS.DECLINED, 'Status transitioned to DECLINED');
    assert(
      declinedApt?.declineReason?.includes('office schedule'),
      'Decline reason properly recorded'
    );

    // Check notification was sent to doctor
    const docDeclineNotifs = await Notification.find({
      recipient: docUser._id,
      type: 'appointment_declined'
    });
    assert(docDeclineNotifs.length > 0, 'Doctor received appointment_declined notification');

    // ----------------------------------------------------
    // Section 8: Patient Suggestion Acceptance Flow
    // ----------------------------------------------------
    console.log('\n--- Section 8: Patient Accepts Proposed Time -> Status CONFIRMED ---');

    // Patient 1 books Wednesday 14:00
    const bookRes3 = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: docProfile._id,
        date: nextWednesday,
        timeSlot: { start: '14:00', end: '14:30' },
        consultationType: APPOINTMENT_TYPES.CHAT,
        reason: 'Post-discharge follow up'
      },
      patientToken
    );
    assert(bookRes3.status === 201, 'Patient 1 books Wednesday 14:00 slot');
    const apt3 = bookRes3.data?.data?.appointment;

    // Doctor suggests Wednesday 15:00 instead
    const suggestRes2 = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt3._id}/suggest-time`,
      {
        date: nextWednesday,
        timeSlot: { start: '15:00', end: '15:30' },
        reason: '15:00 works better for extended review'
      },
      docToken
    );
    assert(suggestRes2.status === 200, 'Doctor suggests Wednesday 15:00');

    // Patient accepts proposed time
    const acceptSuggestedRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt3._id}/patient-accept`,
      {},
      patientToken
    );
    assert(acceptSuggestedRes.status === 200, 'Patient accepts proposed time (200 OK)');
    const confirmedApt = acceptSuggestedRes.data?.data?.appointment;
    assert(
      confirmedApt?.status === APPOINTMENT_STATUS.CONFIRMED,
      'Appointment status transitions to CONFIRMED'
    );
    assert(
      confirmedApt?.timeSlot?.start === '15:00' && confirmedApt?.timeSlot?.end === '15:30',
      'Appointment slot updated to proposed slot (15:00 - 15:30)'
    );

    // Verify chat is now unlocked
    const chatMsgAfterConfirm = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${apt3._id}`,
      { message: 'Hello Dr. Sarah, thank you for confirming!' },
      patientToken
    );
    assert(chatMsgAfterConfirm.status === 201, 'Chat messages successfully permitted on CONFIRMED appointment');

    // Verify Doctor Schedule shows slot as BOOKED
    const scheduleWednesday = await request(
      server,
      'GET',
      `/api/v1/appointments/schedule/view?date=${nextWednesday}`,
      null,
      docToken
    );
    const slot1500 = (scheduleWednesday.data?.data?.slots || []).find((s) => s.start === '15:00');
    assert(slot1500?.state === 'BOOKED', 'Doctor schedule marks accepted slot 15:00 as BOOKED');

    // ----------------------------------------------------
    // Section 9: Direct Doctor Acceptance Flow
    // ----------------------------------------------------
    console.log('\n--- Section 9: Direct Doctor Acceptance Flow ---');

    // Patient books Wednesday 11:00
    const bookRes4 = await request(
      server,
      'POST',
      '/api/v1/appointments',
      {
        doctorId: docProfile._id,
        date: nextWednesday,
        timeSlot: { start: '11:00', end: '11:30' },
        consultationType: APPOINTMENT_TYPES.VIDEO,
        reason: 'Direct acceptance check'
      },
      patientToken
    );
    const apt4 = bookRes4.data?.data?.appointment;

    // Doctor directly accepts
    const doctorAcceptRes = await request(
      server,
      'PATCH',
      `/api/v1/appointments/${apt4._id}/accept`,
      {},
      docToken
    );
    assert(doctorAcceptRes.status === 200, 'Doctor directly accepts appointment');
    const directConfirmedApt = doctorAcceptRes.data?.data?.appointment;
    assert(directConfirmedApt?.status === APPOINTMENT_STATUS.CONFIRMED, 'Directly accepted status is CONFIRMED');

    // Check notification to patient
    const docConfirmedNotifs = await Notification.find({
      recipient: patientUser._id,
      type: 'appointment_confirmed'
    });
    assert(docConfirmedNotifs.length > 0, 'Patient received appointment_confirmed notification');

    // ----------------------------------------------------
    // Section 10: Security & Cleanup
    // ----------------------------------------------------
    console.log('\n--- Section 10: Security & Cleanup ---');

    const schedulePayloadStr = JSON.stringify(scheduleWednesday.data || {});
    assert(
      !schedulePayloadStr.includes('password') &&
      !schedulePayloadStr.includes('JWT_SECRET') &&
      !schedulePayloadStr.includes('MONGO_URI'),
      'Doctor schedule endpoint does not expose credentials or secrets'
    );

    // Cleanup
    await User.deleteMany({ email: { $in: [docEmail, patientEmail, otherPatientEmail] } });
    await DoctorProfile.deleteMany({ _id: docProfile._id });
    await Appointment.deleteMany({ _id: { $in: [apt1._id, apt2._id, apt3._id, apt4._id] } });
    await Notification.deleteMany({
      recipient: { $in: [docUser._id, patientUser._id, otherPatientUser._id] }
    });
    console.log('\n[Test Runner] Temporary test data cleaned up.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  }

  console.log('\n================================================================');
  console.log(`Appointment Workflow Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runWorkflowTests().catch((err) => {
  console.error('[Workflow Test Fatal Error]:', err);
  process.exit(1);
});
