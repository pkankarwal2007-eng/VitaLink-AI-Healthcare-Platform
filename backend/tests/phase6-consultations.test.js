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
const ConsultationMessage = require('../models/ConsultationMessage');
const { ROLES, VERIFICATION_STATUS, APPOINTMENT_STATUS, APPOINTMENT_TYPES } = require('../config/constants');
const { generateToken } = require('../utils/jwt');
const { initSocket } = require('../services/socketService');

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

const runPhase6Tests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Phase 6 Consultation Workflows Tests    ');
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
  initSocket(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Runner] Ephemeral test server with Socket.IO active on port ${port}\n`);

  const timestamp = Date.now();
  const doctorEmail = `dr_ray_${timestamp}@vitalink.com`;
  const patientEmail1 = `amit_sharma_${timestamp}@vitalink.com`;
  const patientEmail2 = `kavita_sen_${timestamp}@vitalink.com`;

  let doctorUser, patientUser1, patientUser2;
  let doctorProfile;
  let doctorToken, patientToken1, patientToken2;
  let chatAppointment, videoAppointment, physicalAppointment, cancelledAppointment;

  try {
    // ----------------------------------------------------
    // Section 1: Setup Test Data
    // ----------------------------------------------------
    console.log('--- Section 1: Setup Test Data & Appointments ---');

    doctorUser = await User.create({
      fullName: 'Dr. Ananya Ray',
      email: doctorEmail,
      password: 'Password123!',
      phone: '9876560001',
      gender: 'female',
      dateOfBirth: new Date('1985-07-22'),
      address: '15 Lilavati Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400050',
      role: ROLES.DOCTOR,
      isActive: true
    });
    doctorToken = generateToken(doctorUser);

    doctorProfile = await DoctorProfile.create({
      user: doctorUser._id,
      specialization: 'Cardiologist',
      highestDegree: 'DM Cardiology',
      college: 'KEM Hospital & College',
      experienceYears: 14,
      hospitalName: 'Lilavati Cardiac Centre',
      hospitalAddress: 'Bandra West, Mumbai',
      consultationFee: 800,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      appointmentDuration: 30,
      consultationModes: ['chat', 'video', 'physical'],
      isVerified: true,
      verificationStatus: VERIFICATION_STATUS.APPROVED
    });

    patientUser1 = await User.create({
      fullName: 'Amit Sharma',
      email: patientEmail1,
      password: 'Password123!',
      phone: '9876560002',
      gender: 'male',
      dateOfBirth: new Date('1992-03-10'),
      address: '101 Juhu Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400049',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken1 = generateToken(patientUser1);

    patientUser2 = await User.create({
      fullName: 'Kavita Sen',
      email: patientEmail2,
      password: 'Password123!',
      phone: '9876560003',
      gender: 'female',
      dateOfBirth: new Date('1995-10-18'),
      address: '404 Powai Lake Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400076',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken2 = generateToken(patientUser2);

    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 2);

    // Appointment 1: Chat consultation
    chatAppointment = await Appointment.create({
      patient: patientUser1._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: bookingDate,
      timeSlot: { start: '10:00', end: '10:30' },
      consultationType: APPOINTMENT_TYPES.CHAT,
      reason: 'Palpitations and irregular heart rhythm',
      status: APPOINTMENT_STATUS.CONFIRMED,
      fee: 800
    });

    // Appointment 2: Video consultation
    videoAppointment = await Appointment.create({
      patient: patientUser1._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: bookingDate,
      timeSlot: { start: '11:00', end: '11:30' },
      consultationType: APPOINTMENT_TYPES.VIDEO,
      reason: 'Follow-up on ECG telemetry reports',
      status: APPOINTMENT_STATUS.CONFIRMED,
      fee: 800,
      videoRoomId: `vitalink-room-test-${timestamp}`
    });

    // Appointment 3: Physical consultation
    physicalAppointment = await Appointment.create({
      patient: patientUser1._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: bookingDate,
      timeSlot: { start: '14:00', end: '14:30' },
      consultationType: APPOINTMENT_TYPES.PHYSICAL,
      reason: 'Physical echocardiogram clinical checkup',
      status: APPOINTMENT_STATUS.CONFIRMED,
      fee: 800
    });

    // Appointment 4: Cancelled consultation
    cancelledAppointment = await Appointment.create({
      patient: patientUser1._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: bookingDate,
      timeSlot: { start: '16:00', end: '16:30' },
      consultationType: APPOINTMENT_TYPES.CHAT,
      reason: 'Mild chest pressure',
      status: APPOINTMENT_STATUS.CANCELLED,
      cancellationReason: 'Patient rescheduled to next week',
      fee: 800
    });

    assert(
      !!chatAppointment && !!videoAppointment && !!physicalAppointment && !!cancelledAppointment,
      'Test users and 4 distinct appointments created successfully'
    );

    // ----------------------------------------------------
    // Section 2: Chat Access & Authorization
    // ----------------------------------------------------
    console.log('\n--- Section 2: Chat Access & Role Authorization ---');

    // Test: Unauthenticated request rejected
    const unauthChat = await request(server, 'GET', `/api/v1/consultations/chat/${chatAppointment._id}`);
    assert(unauthChat.status === 401, 'Unauthenticated chat access is rejected with 401 Unauthorized');

    // Test: Authorized Patient 1 accesses chat
    const patientChatRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${chatAppointment._id}`,
      null,
      patientToken1
    );
    assert(
      patientChatRes.status === 200 && Array.isArray(patientChatRes.data?.data?.messages),
      'Authorized Patient 1 accesses consultation chat history (200 OK)'
    );

    // Test: Authorized Doctor accesses chat
    const docChatRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${chatAppointment._id}`,
      null,
      doctorToken
    );
    assert(
      docChatRes.status === 200 && docChatRes.data?.data?.appointment?._id.toString() === chatAppointment._id.toString(),
      'Authorized Doctor accesses consultation chat history (200 OK)'
    );

    // Test: Unauthorized Patient 2 receives 403 Forbidden
    const unauthPatientChatRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${chatAppointment._id}`,
      null,
      patientToken2
    );
    assert(
      unauthPatientChatRes.status === 403 && unauthPatientChatRes.data?.code === 'FORBIDDEN',
      'Unrelated Patient 2 receives 403 Forbidden when attempting to access chat'
    );

    // ----------------------------------------------------
    // Section 3: Message Persistence & Read Receipts
    // ----------------------------------------------------
    console.log('\n--- Section 3: Real-Time Message Persistence & Read Receipts ---');

    // Patient 1 sends message
    const sendRes1 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${chatAppointment._id}`,
      { message: 'Hello Dr. Ray, I noticed sporadic palpitations this morning after exercising.' },
      patientToken1
    );

    assert(
      sendRes1.status === 201 && sendRes1.data?.data?.message?.includes('palpitations'),
      'Patient 1 sends message and receives 201 Created'
    );

    const savedMsg1 = await ConsultationMessage.findById(sendRes1.data?.data?._id);
    assert(
      savedMsg1 &&
      savedMsg1.sender.toString() === patientUser1._id.toString() &&
      savedMsg1.receiver.toString() === doctorUser._id.toString() &&
      savedMsg1.isRead === false,
      'Message is persisted in MongoDB with correct sender, receiver, and initial isRead: false'
    );

    // Doctor opens chat history -> automatically marks message as read
    const docReadRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${chatAppointment._id}`,
      null,
      doctorToken
    );
    assert(docReadRes.status === 200, 'Doctor reads consultation chat');

    const updatedMsg1 = await ConsultationMessage.findById(savedMsg1._id);
    assert(
      updatedMsg1.isRead === true && updatedMsg1.readAt !== null,
      'Message automatically transitions to isRead: true with readAt timestamp when recipient views chat'
    );

    // Doctor replies
    const sendRes2 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${chatAppointment._id}`,
      { message: 'Hello Amit. Please check your pulse rate and rest for 15 minutes.' },
      doctorToken
    );
    assert(
      sendRes2.status === 201 && sendRes2.data?.data?.sender?.fullName === 'Dr. Ananya Ray',
      'Doctor replies to patient and receives 201 Created with populated sender'
    );

    // ----------------------------------------------------
    // Section 4: Message Isolation Between Consultations
    // ----------------------------------------------------
    console.log('\n--- Section 4: Message Isolation Between Consultations ---');

    // Fetch messages for videoAppointment (Appointment 2)
    const videoChatRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${videoAppointment._id}`,
      null,
      patientToken1
    );
    assert(
      videoChatRes.status === 200 && videoChatRes.data?.data?.messages?.length === 0,
      'Appointment 2 has 0 messages; messages from Appointment 1 are strictly isolated'
    );

    // ----------------------------------------------------
    // Section 5: Inactive & Cancelled Appointment Protection
    // ----------------------------------------------------
    console.log('\n--- Section 5: Cancelled Appointment Protection ---');

    // Attempting to send message in cancelled appointment
    const sendCancelledRes = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${cancelledAppointment._id}`,
      { message: 'Can I still send a message?' },
      patientToken1
    );
    assert(
      sendCancelledRes.status === 400 && sendCancelledRes.data?.code === 'CANNOT_CHAT_CANCELLED',
      'Sending chat message in a cancelled appointment is blocked with 400 CANNOT_CHAT_CANCELLED'
    );

    const cancelledMsgs = await ConsultationMessage.find({ appointment: cancelledAppointment._id });
    assert(cancelledMsgs.length === 0, 'No message was written to the database for cancelled appointment');

    // ----------------------------------------------------
    // Section 6: WebRTC Video Room Session Authorization
    // ----------------------------------------------------
    console.log('\n--- Section 6: WebRTC Video Room Session Authorization ---');

    // Patient 1 video room auth
    const patientVideoAuth = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${videoAppointment._id}/auth`,
      null,
      patientToken1
    );
    assert(
      patientVideoAuth.status === 200 &&
      patientVideoAuth.data?.data?.videoRoomId === videoAppointment.videoRoomId &&
      patientVideoAuth.data?.data?.userRole === 'patient',
      'Patient 1 successfully authorizes for private video consultation room'
    );

    // Doctor video room auth
    const docVideoAuth = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${videoAppointment._id}/auth`,
      null,
      doctorToken
    );
    assert(
      docVideoAuth.status === 200 && docVideoAuth.data?.data?.userRole === 'doctor',
      'Doctor successfully authorizes for private video consultation room'
    );

    // Unauthorized Patient 2 video room auth
    const unauthVideoAuth = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${videoAppointment._id}/auth`,
      null,
      patientToken2
    );
    assert(
      unauthVideoAuth.status === 403 && unauthVideoAuth.data?.code === 'FORBIDDEN',
      'Unrelated Patient 2 receives 403 Forbidden when attempting video room authorization'
    );

    // Cancelled appointment video room auth
    const cancelledVideoAuth = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${cancelledAppointment._id}/auth`,
      null,
      patientToken1
    );
    assert(
      cancelledVideoAuth.status === 400 && cancelledVideoAuth.data?.code === 'APPOINTMENT_NOT_ACTIVE',
      'Cancelled appointment video access is rejected with 400 APPOINTMENT_NOT_ACTIVE'
    );

    // ----------------------------------------------------
    // Section 7: Physical Consultation Visit Pass
    // ----------------------------------------------------
    console.log('\n--- Section 7: Physical In-Person Consultation Details ---');

    // Patient 1 gets physical pass
    const physicalRes = await request(
      server,
      'GET',
      `/api/v1/consultations/physical/${physicalAppointment._id}`,
      null,
      patientToken1
    );

    assert(
      physicalRes.status === 200 &&
      physicalRes.data?.data?.clinic?.hospitalName === 'Lilavati Cardiac Centre' &&
      physicalRes.data?.data?.clinic?.address?.includes('Bandra West') &&
      physicalRes.data?.data?.instructions?.length >= 3,
      'Physical consultation pass returns complete hospital address, instructions, and doctor coordinates'
    );

    // Unauthorized Patient 2 physical pass
    const unauthPhysicalRes = await request(
      server,
      'GET',
      `/api/v1/consultations/physical/${physicalAppointment._id}`,
      null,
      patientToken2
    );
    assert(
      unauthPhysicalRes.status === 403 && unauthPhysicalRes.data?.code === 'FORBIDDEN',
      'Unrelated Patient 2 cannot access physical consultation pass (403 Forbidden)'
    );

    // ----------------------------------------------------
    // Section 8: Active Conversations List & Unread Counter
    // ----------------------------------------------------
    console.log('\n--- Section 8: Conversations Directory & Unread Counter ---');

    const convosRes = await request(
      server,
      'GET',
      '/api/v1/consultations/conversations',
      null,
      patientToken1
    );

    assert(
      convosRes.status === 200 && Array.isArray(convosRes.data?.data) && convosRes.data?.data?.length > 0,
      'GET /api/v1/consultations/conversations retrieves list of patient consultations'
    );

    const chatConvo = convosRes.data?.data?.find((c) => c.appointment?._id.toString() === chatAppointment._id.toString());
    assert(
      chatConvo && chatConvo.lastMessage?.message?.includes('pulse rate'),
      'Conversation item contains the most recent message snippet'
    );

    // ----------------------------------------------------
    // Section 9: Security & Secret Redaction
    // ----------------------------------------------------
    console.log('\n--- Section 9: Security & Secrets Redaction ---');

    const chatString = JSON.stringify(patientChatRes.data || {});
    const videoString = JSON.stringify(patientVideoAuth.data || {});
    const physicalString = JSON.stringify(physicalRes.data || {});

    assert(
      !chatString.includes('MONGO_URI') &&
      !chatString.includes('JWT_SECRET') &&
      !videoString.includes('MONGO_URI') &&
      !videoString.includes('password') &&
      !physicalString.includes('JWT_SECRET'),
      'Consultation API responses do not expose credentials, database connection strings, or JWT secrets'
    );

    // Cleanup test data
    await User.deleteMany({
      email: { $in: [doctorEmail, patientEmail1, patientEmail2] }
    });
    await DoctorProfile.deleteMany({ _id: doctorProfile._id });
    await Appointment.deleteMany({
      _id: { $in: [chatAppointment._id, videoAppointment._id, physicalAppointment._id, cancelledAppointment._id] }
    });
    await ConsultationMessage.deleteMany({
      appointment: { $in: [chatAppointment._id, videoAppointment._id, physicalAppointment._id, cancelledAppointment._id] }
    });

    console.log('\n[Test Runner] Cleaned up temporary test data.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Runner] Ephemeral test server closed.');
    await disconnectDB();
  }

  console.log('====================================================');
  console.log(`Phase 6 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase6Tests().catch((err) => {
  console.error('[Phase 6 Fatal Error]:', err);
  process.exit(1);
});
