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

/**
 * Mirror of frontend message ownership resolution logic in ChatConsultationPage.jsx
 */
const getMessageSenderId = (msg) => {
  if (!msg) return '';
  const s = msg.sender ?? msg.user ?? msg.senderId;
  if (!s) return '';
  if (typeof s === 'object') {
    return (s._id || s.id)?.toString() || '';
  }
  return s.toString();
};

const resolveMessageAlignment = (msg, currentUserId) => {
  const senderId = getMessageSenderId(msg);
  const isMe = Boolean(currentUserId && senderId && senderId.toLowerCase() === currentUserId.toLowerCase());
  return isMe ? 'RIGHT' : 'LEFT';
};

const runChatPerspectiveTests = async () => {
  console.log('================================================================');
  console.log('   VitaLink Consultation Chat Two-Person Perspective Test Suite ');
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
  initSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Runner] Ephemeral test server active on port ${port}\n`);

  const ts = Date.now();
  const docEmail = `chat_doc_${ts}@vitalink.com`;
  const patientEmail = `chat_patient_${ts}@vitalink.com`;

  let docUser, patientUser, docProfile;
  let docToken, patientToken;
  let appointment;

  try {
    // ----------------------------------------------------
    // Section 1: Preconditions Setup
    // ----------------------------------------------------
    console.log('--- Section 1: Setup Doctor, Patient & Confirmed Appointment ---');

    docUser = await User.create({
      fullName: 'Dr. Pankaj Kankarwal',
      email: docEmail,
      password: 'Password123!',
      phone: '9876543201',
      gender: 'male',
      dateOfBirth: new Date('1988-04-10'),
      address: '201 Medical Enclave',
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      role: ROLES.DOCTOR,
      isActive: true
    });
    docToken = generateToken(docUser);

    docProfile = await DoctorProfile.create({
      user: docUser._id,
      specialization: 'Neurologist',
      medicalRegistrationNumber: `DMC-${ts}`,
      consultationFee: 900,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      appointmentDuration: 30,
      consultationModes: ['chat', 'video'],
      isVerified: true,
      verificationStatus: VERIFICATION_STATUS.APPROVED
    });

    patientUser = await User.create({
      fullName: 'Aarav Mehta',
      email: patientEmail,
      password: 'Password123!',
      phone: '9876543202',
      gender: 'male',
      dateOfBirth: new Date('2000-07-15'),
      address: '402 Vasant Vihar',
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110057',
      role: ROLES.PATIENT,
      isActive: true
    });
    patientToken = generateToken(patientUser);

    const aptDate = new Date();
    aptDate.setDate(aptDate.getDate() + 1);

    appointment = await Appointment.create({
      patient: patientUser._id,
      doctor: docUser._id,
      doctorProfile: docProfile._id,
      date: aptDate,
      timeSlot: { start: '11:00', end: '11:30' },
      consultationType: APPOINTMENT_TYPES.CHAT,
      reason: 'Recurrent migraine headaches and nausea',
      status: APPOINTMENT_STATUS.CONFIRMED,
      fee: 900
    });

    assert(Boolean(appointment._id), 'Confirmed chat consultation appointment created');

    // ----------------------------------------------------
    // Section 2: Conversation Generation (Patient & Doctor)
    // ----------------------------------------------------
    console.log('\n--- Section 2: Send Realistic Conversation Messages ---');

    // Message 1: Patient
    const p1 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${appointment._id}`,
      { message: 'Namaste doctor, mujhe do din se tez sir dard ho raha hai' },
      patientToken
    );
    assert(p1.status === 201, 'Patient sends message 1 (201 Created)');

    // Message 2: Patient sends follow-up
    const p2 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${appointment._id}`,
      { message: 'Aankhon ke piche bohot pressure feel ho raha hai' },
      patientToken
    );
    assert(p2.status === 201, 'Patient sends message 2 (201 Created)');

    // Message 3: Doctor replies
    const d1 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${appointment._id}`,
      { message: 'Namaste Aarav ji. Kya ulti ya nausea bhi mehsoos ho rahi hai?' },
      docToken
    );
    assert(d1.status === 201, 'Doctor sends message 3 (201 Created)');

    // Message 4: Doctor asks follow-up
    const d2 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${appointment._id}`,
      { message: 'Kripya batayein kya tez roshni ya aawaz se dard badhta hai?' },
      docToken
    );
    assert(d2.status === 201, 'Doctor sends message 4 (201 Created)');

    // Message 5: Patient responds
    const p3 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${appointment._id}`,
      { message: 'Haan doctor, light se aankhein band karni padti hain' },
      patientToken
    );
    assert(p3.status === 201, 'Patient sends message 5 (201 Created)');

    // ----------------------------------------------------
    // Section 3: Patient Perspective Verification
    // ----------------------------------------------------
    console.log('\n--- Section 3: Patient Perspective (GET /chat/:id) ---');

    const patientViewRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${appointment._id}`,
      null,
      patientToken
    );
    assert(patientViewRes.status === 200, 'Patient retrieves chat history (200 OK)');
    const patientMessages = patientViewRes.data?.data?.messages || [];
    assert(patientMessages.length === 5, 'Patient sees all 5 conversation messages');

    const patientUserId = patientUser._id.toString();

    // Verify alignment for each message from Patient view
    const patientAlignments = patientMessages.map((m) => resolveMessageAlignment(m, patientUserId));
    assert(
      patientAlignments[0] === 'RIGHT' &&
      patientAlignments[1] === 'RIGHT' &&
      patientAlignments[2] === 'LEFT' &&
      patientAlignments[3] === 'LEFT' &&
      patientAlignments[4] === 'RIGHT',
      'PATIENT VIEW: Patient messages align RIGHT, Doctor messages align LEFT'
    );

    // Verify Patient Header Information
    const aptInPatientView = patientViewRes.data?.data?.appointment;
    assert(
      aptInPatientView.doctor?.fullName === 'Dr. Pankaj Kankarwal' &&
      aptInPatientView.doctorProfile?.specialization === 'Neurologist',
      'PATIENT VIEW: Identifies Doctor with full name and specialization'
    );

    // ----------------------------------------------------
    // Section 4: Doctor Perspective Verification
    // ----------------------------------------------------
    console.log('\n--- Section 4: Doctor Perspective (GET /chat/:id) ---');

    const docViewRes = await request(
      server,
      'GET',
      `/api/v1/consultations/chat/${appointment._id}`,
      null,
      docToken
    );
    assert(docViewRes.status === 200, 'Doctor retrieves chat history (200 OK)');
    const docMessages = docViewRes.data?.data?.messages || [];
    assert(docMessages.length === 5, 'Doctor sees all 5 conversation messages');

    const docUserId = docUser._id.toString();

    // Verify alignment for each message from Doctor view
    const docAlignments = docMessages.map((m) => resolveMessageAlignment(m, docUserId));
    assert(
      docAlignments[0] === 'LEFT' &&
      docAlignments[1] === 'LEFT' &&
      docAlignments[2] === 'RIGHT' &&
      docAlignments[3] === 'RIGHT' &&
      docAlignments[4] === 'LEFT',
      'DOCTOR VIEW: Doctor messages align RIGHT, Patient messages align LEFT'
    );

    // Verify Doctor Header Information
    const aptInDocView = docViewRes.data?.data?.appointment;
    assert(
      aptInDocView.patient?.fullName === 'Aarav Mehta' &&
      aptInDocView.patient?.gender === 'male' &&
      Boolean(aptInDocView.patient?.dateOfBirth),
      'DOCTOR VIEW: Identifies Patient with full name, gender, and dateOfBirth'
    );

    // ----------------------------------------------------
    // Section 5: Chronological Order Invariance Check
    // ----------------------------------------------------
    console.log('\n--- Section 5: Chronological Order Invariance ---');

    const patientMsgTexts = patientMessages.map((m) => m.message);
    const docMsgTexts = docMessages.map((m) => m.message);

    assert(
      JSON.stringify(patientMsgTexts) === JSON.stringify(docMsgTexts),
      'Exact identical chronological message order in both Patient and Doctor views'
    );

    // ----------------------------------------------------
    // Section 6: Dynamic Real-time Incoming Message Handling
    // ----------------------------------------------------
    console.log('\n--- Section 6: Realtime Ownership Validation ---');

    // Simulate doctor sending a new message
    const d3 = await request(
      server,
      'POST',
      `/api/v1/consultations/chat/${appointment._id}`,
      { message: 'Aap bilkul chinta na karein, main prescription update kar raha hoon' },
      docToken
    );
    const newDocMsg = d3.data?.data;

    // Evaluate how this new incoming message aligns for both users
    const newDocMsgForDoctor = resolveMessageAlignment(newDocMsg, docUserId);
    const newDocMsgForPatient = resolveMessageAlignment(newDocMsg, patientUserId);

    assert(
      newDocMsgForDoctor === 'RIGHT',
      'Realtime doctor message appears on RIGHT for Doctor'
    );
    assert(
      newDocMsgForPatient === 'LEFT',
      'Realtime doctor message appears on LEFT for Patient'
    );

    // ----------------------------------------------------
    // Section 7: Read Receipt Transition Check
    // ----------------------------------------------------
    console.log('\n--- Section 7: Read Receipt Transition Check ---');

    // Doctor fetched chat history in Section 4, which automatically marks patient's unread messages as read
    const updatedMessagesInDB = await ConsultationMessage.find({ appointment: appointment._id }).lean();
    const patientFirstMsg = updatedMessagesInDB.find((m) => m.message.includes('tez sir dard'));
    assert(
      patientFirstMsg?.isRead === true && Boolean(patientFirstMsg?.readAt),
      'Read receipts (isRead: true, readAt) correctly recorded when recipient views consultation'
    );

    // ----------------------------------------------------
    // Section 8: Cleanup
    // ----------------------------------------------------
    console.log('\n--- Section 8: Cleanup ---');
    await User.deleteMany({ email: { $in: [docEmail, patientEmail] } });
    await DoctorProfile.deleteMany({ _id: docProfile._id });
    await Appointment.deleteMany({ _id: appointment._id });
    await ConsultationMessage.deleteMany({ appointment: appointment._id });
    console.log('[Test Runner] Temporary test data cleaned up.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  }

  console.log('\n================================================================');
  console.log(`Chat Perspective Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runChatPerspectiveTests().catch((err) => {
  console.error('[Chat Perspective Fatal Error]:', err);
  process.exit(1);
});
