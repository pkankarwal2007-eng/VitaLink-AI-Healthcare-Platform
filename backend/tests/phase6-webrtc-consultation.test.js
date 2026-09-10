const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const { io: ClientIO } = require('socket.io-client');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const Appointment = require('../models/Appointment');
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

const runWebRTCTestSuite = async () => {
  console.log('====================================================');
  console.log('  VitaLink WebRTC Video Consultation Test Suite     ');
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
  console.log(`[Test Server] Ephemeral HTTP & Socket.IO active on port ${port}\n`);

  const timestamp = Date.now();
  const doctorEmail = `dr_webrtc_${timestamp}@vitalink.com`;
  const patientEmail1 = `patient_webrtc1_${timestamp}@vitalink.com`;
  const patientEmail2 = `patient_webrtc2_${timestamp}@vitalink.com`;

  let doctorUser, patientUser1, patientUser2;
  let doctorProfile;
  let doctorToken, patientToken1, patientToken2;
  let videoAppointment, cancelledAppointment;
  let doctorSocket, patientSocket;

  try {
    // ----------------------------------------------------
    // Section 1: Test Fixtures
    // ----------------------------------------------------
    console.log('--- Section 1: Setting Up Doctor, Patients & Video Appointment ---');

    doctorUser = await User.create({
      fullName: 'Dr. Alisha Verma',
      email: doctorEmail,
      password: 'Password123!',
      phone: '9876540001',
      gender: 'female',
      dateOfBirth: new Date('1988-04-12'),
      address: '22 Bandra Medical enclave',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400050',
      role: ROLES.DOCTOR,
      isActive: true
    });

    patientUser1 = await User.create({
      fullName: 'Rohan Mehta',
      email: patientEmail1,
      password: 'Password123!',
      phone: '9876540002',
      gender: 'male',
      dateOfBirth: new Date('1994-08-20'),
      address: '404 Juhu Tara Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400049',
      role: ROLES.PATIENT,
      isActive: true
    });

    patientUser2 = await User.create({
      fullName: 'Sneha Kapur',
      email: patientEmail2,
      password: 'Password123!',
      phone: '9876540003',
      gender: 'female',
      dateOfBirth: new Date('1996-12-05'),
      address: '10 Hiranandani Gardens',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400076',
      role: ROLES.PATIENT,
      isActive: true
    });

    doctorProfile = await DoctorProfile.create({
      user: doctorUser._id,
      specialization: 'Cardiologist',
      highestDegree: 'MD Cardiology',
      college: 'AIIMS New Delhi',
      experienceYears: 10,
      hospitalName: 'Lilavati Cardiac Centre',
      hospitalAddress: 'Bandra West, Mumbai',
      consultationFee: 750,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTime: { start: '09:00', end: '17:00' },
      appointmentDuration: 30,
      consultationModes: ['video', 'chat', 'physical'],
      isVerified: true,
      verificationStatus: VERIFICATION_STATUS.APPROVED
    });

    doctorToken = generateToken(doctorUser);
    patientToken1 = generateToken(patientUser1);
    patientToken2 = generateToken(patientUser2);

    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 2);

    videoAppointment = await Appointment.create({
      patient: patientUser1._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: bookingDate,
      timeSlot: { start: '10:00', end: '10:30' },
      consultationType: APPOINTMENT_TYPES.VIDEO,
      reason: 'Frequent palpitations and dizziness',
      status: APPOINTMENT_STATUS.CONFIRMED,
      fee: 750,
      videoRoomId: `vitalink-room-test-${timestamp}`
    });

    cancelledAppointment = await Appointment.create({
      patient: patientUser1._id,
      doctor: doctorUser._id,
      doctorProfile: doctorProfile._id,
      date: bookingDate,
      timeSlot: { start: '11:00', end: '11:30' },
      consultationType: APPOINTMENT_TYPES.VIDEO,
      reason: 'Routine checkup',
      status: APPOINTMENT_STATUS.CANCELLED,
      fee: 750,
      videoRoomId: `vitalink-room-cancelled-${timestamp}`
    });

    assert(Boolean(videoAppointment._id), 'Video appointment created successfully with ID: ' + videoAppointment._id);
    assert(Boolean(videoAppointment.videoRoomId), 'videoRoomId is correctly assigned as ' + videoAppointment.videoRoomId);

    // ----------------------------------------------------
    // Section 2: Video Room Session Authorization API
    // ----------------------------------------------------
    console.log('\n--- Section 2: Video Room Session Authorization Endpoint ---');

    // Doctor authorization
    const docAuthRes = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${videoAppointment._id}/auth`,
      null,
      doctorToken
    );
    assert(docAuthRes.status === 200, 'Doctor authorization returns 200 OK');
    assert(docAuthRes.data?.data?.userRole === 'doctor', 'Doctor role correctly recognized');
    assert(docAuthRes.data?.data?.videoRoomId === videoAppointment.videoRoomId, 'Room ID matches videoAppointment.videoRoomId');
    assert(docAuthRes.data?.data?.peer?.name === 'Rohan Mehta', 'Doctor receives correct patient peer name');
    assert(Array.isArray(docAuthRes.data?.data?.iceServers) && docAuthRes.data?.data?.iceServers.length > 0, 'Returns STUN iceServers configuration');

    // Patient 1 authorization
    const patientAuthRes = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${videoAppointment._id}/auth`,
      null,
      patientToken1
    );
    assert(patientAuthRes.status === 200, 'Patient 1 authorization returns 200 OK');
    assert(patientAuthRes.data?.data?.userRole === 'patient', 'Patient role correctly recognized');
    assert(patientAuthRes.data?.data?.peer?.name === 'Dr. Alisha Verma', 'Patient receives correct doctor peer name');

    // Unauthorized Patient 2 access
    const unauthRes = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${videoAppointment._id}/auth`,
      null,
      patientToken2
    );
    assert(unauthRes.status === 403 && unauthRes.data?.code === 'FORBIDDEN', 'Unrelated patient is blocked with 403 FORBIDDEN');

    // Cancelled appointment access
    const cancelledRes = await request(
      server,
      'GET',
      `/api/v1/consultations/video/${cancelledAppointment._id}/auth`,
      null,
      patientToken1
    );
    assert(cancelledRes.status === 400 && cancelledRes.data?.code === 'APPOINTMENT_NOT_ACTIVE', 'Cancelled appointment is blocked with 400 APPOINTMENT_NOT_ACTIVE');

    // ----------------------------------------------------
    // Section 3: Socket.IO WebRTC Signaling Handshake
    // ----------------------------------------------------
    console.log('\n--- Section 3: Socket.IO WebRTC Signaling Protocol ---');

    const socketUrl = `http://127.0.0.1:${port}`;

    doctorSocket = ClientIO(socketUrl, {
      auth: { token: doctorToken },
      transports: ['websocket'],
      forceNew: true
    });

    patientSocket = ClientIO(socketUrl, {
      auth: { token: patientToken1 },
      transports: ['websocket'],
      forceNew: true
    });

    // Wait for both sockets to connect
    await Promise.all([
      new Promise((resolve) => doctorSocket.on('connect', resolve)),
      new Promise((resolve) => patientSocket.on('connect', resolve))
    ]);
    assert(doctorSocket.connected && patientSocket.connected, 'Both Doctor and Patient sockets connected to Socket.IO gateway');

    const roomId = `video:${videoAppointment._id}`;

    // Doctor joins video room
    const docJoinPromise = new Promise((resolve) => {
      doctorSocket.emit('join-video-room', { roomId }, (response) => {
        resolve(response);
      });
    });
    const docJoinAck = await docJoinPromise;
    assert(docJoinAck?.success === true && docJoinAck?.participantCount === 1, 'Doctor joins video room; acknowledged with participantCount = 1');

    // Patient joins video room, Doctor should receive user-joined
    const userJoinedPromise = new Promise((resolve) => {
      doctorSocket.once('user-joined', (data) => {
        resolve(data);
      });
    });

    const patientJoinPromise = new Promise((resolve) => {
      patientSocket.emit('join-video-room', { roomId }, (response) => {
        resolve(response);
      });
    });

    const [patientJoinAck, userJoinedData] = await Promise.all([patientJoinPromise, userJoinedPromise]);
    assert(patientJoinAck?.success === true && patientJoinAck?.participantCount === 2, 'Patient joins video room; acknowledged with participantCount = 2');
    assert(userJoinedData?.userId === patientUser1._id.toString() && userJoinedData?.role === 'patient', 'Doctor received user-joined event with patient credentials');

    // Signaling Handshake Step 1: client-ready -> peer-ready
    const docPeerReadyPromise = new Promise((resolve) => {
      doctorSocket.once('peer-ready', (data) => resolve(data));
    });
    patientSocket.emit('client-ready', { roomId });
    const docPeerReady = await docPeerReadyPromise;
    assert(docPeerReady?.userId === patientUser1._id.toString(), 'Doctor received peer-ready from patient to coordinate SDP negotiation');

    // Signaling Handshake Step 2: webrtc-offer relay
    const testSdpOffer = { type: 'offer', sdp: 'v=0\r\no=vitalink-doctor 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
    const patientOfferPromise = new Promise((resolve) => {
      patientSocket.once('webrtc-offer', (data) => resolve(data));
    });
    doctorSocket.emit('webrtc-offer', { roomId, sdp: testSdpOffer });
    const receivedOffer = await patientOfferPromise;
    assert(receivedOffer?.sdp?.type === 'offer' && receivedOffer?.fromUserId === doctorUser._id.toString(), 'Patient received relayed WebRTC SDP offer from Doctor');

    // Signaling Handshake Step 3: webrtc-answer relay
    const testSdpAnswer = { type: 'answer', sdp: 'v=0\r\no=vitalink-patient 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
    const docAnswerPromise = new Promise((resolve) => {
      doctorSocket.once('webrtc-answer', (data) => resolve(data));
    });
    patientSocket.emit('webrtc-answer', { roomId, sdp: testSdpAnswer });
    const receivedAnswer = await docAnswerPromise;
    assert(receivedAnswer?.sdp?.type === 'answer' && receivedAnswer?.fromUserId === patientUser1._id.toString(), 'Doctor received relayed WebRTC SDP answer from Patient');

    // Signaling Handshake Step 4: webrtc-ice-candidate relay
    const testCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    const patientCandidatePromise = new Promise((resolve) => {
      patientSocket.once('webrtc-ice-candidate', (data) => resolve(data));
    });
    doctorSocket.emit('webrtc-ice-candidate', { roomId, candidate: testCandidate });
    const receivedCandidate = await patientCandidatePromise;
    assert(receivedCandidate?.candidate?.sdpMid === '0' && receivedCandidate?.candidate?.sdpMLineIndex === 0, 'Patient received relayed ICE candidate from Doctor');

    // Signaling Step 5: peer-toggle-media (audio/video mute state broadcast)
    const patientMediaTogglePromise = new Promise((resolve) => {
      patientSocket.once('peer-toggle-media', (data) => resolve(data));
    });
    doctorSocket.emit('peer-toggle-media', { roomId, audio: false, video: true });
    const receivedToggle = await patientMediaTogglePromise;
    assert(receivedToggle?.audio === false && receivedToggle?.video === true, 'Patient received doctor media toggle (audio muted, video active)');

    // Signaling Step 6: In-call Consultation Chat Relay
    const patientChatMessagePromise = new Promise((resolve) => {
      patientSocket.once('receive-video-message', (data) => resolve(data));
    });
    doctorSocket.emit('send-video-message', {
      appointmentId: videoAppointment._id,
      message: 'Good morning Rohan, how are your palpitations today?'
    });
    const receivedChatMessage = await patientChatMessagePromise;
    assert(
      receivedChatMessage?.message?.includes('palpitations') && receivedChatMessage?.senderName === 'Dr. Alisha Verma',
      'In-call consultation chat message relayed successfully in real-time'
    );

    // Signaling Step 7: end-consultation event
    const patientCallEndedPromise = new Promise((resolve) => {
      patientSocket.once('call-ended', (data) => resolve(data));
    });
    doctorSocket.emit('end-consultation', { roomId, duration: 245 });
    const receivedCallEnd = await patientCallEndedPromise;
    assert(receivedCallEnd?.duration === 245, 'Patient received call-ended event with accurate consultation duration (245s)');

    // ----------------------------------------------------
    // Section 4: End Consultation API & Duration Persistence
    // ----------------------------------------------------
    console.log('\n--- Section 4: Video Consultation End Endpoint & DB Persistence ---');

    const endSessionRes = await request(
      server,
      'PATCH',
      `/api/v1/consultations/video/${videoAppointment._id}/end`,
      {
        duration: 245,
        notes: 'Consultation concluded. Prescribed ECG and Holter monitor.'
      },
      doctorToken
    );

    assert(endSessionRes.status === 200, 'End consultation endpoint returns 200 OK');
    assert(endSessionRes.data?.data?.consultationDuration === 245, 'Response reflects 245 seconds consultation duration');
    assert(endSessionRes.data?.data?.lastConsultationStatus?.toLowerCase() === 'completed', 'Appointment marked as completed for consultation status');

    // Verify database document
    const updatedAppointment = await Appointment.findById(videoAppointment._id);
    assert(updatedAppointment.consultationDuration === 245, 'MongoDB Appointment.consultationDuration persisted accurately (245s)');
    assert(Boolean(updatedAppointment.consultationEndedAt), 'MongoDB Appointment.consultationEndedAt timestamp recorded');
    assert(updatedAppointment.lastConsultationStatus?.toLowerCase() === 'completed', 'MongoDB Appointment.lastConsultationStatus recorded as completed');
    assert(updatedAppointment.status === APPOINTMENT_STATUS.CONFIRMED, 'Appointment base status remains CONFIRMED (safe medical workflow)');

  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    failed++;
  } finally {
    // Teardown
    console.log('\n--- Cleaning Up Sockets, Test Data & Server ---');
    if (doctorSocket?.connected) doctorSocket.disconnect();
    if (patientSocket?.connected) patientSocket.disconnect();

    if (doctorProfile?._id) await DoctorProfile.findByIdAndDelete(doctorProfile._id);
    if (videoAppointment?._id) await Appointment.findByIdAndDelete(videoAppointment._id);
    if (cancelledAppointment?._id) await Appointment.findByIdAndDelete(cancelledAppointment._id);
    if (doctorUser?._id) await User.findByIdAndDelete(doctorUser._id);
    if (patientUser1?._id) await User.findByIdAndDelete(patientUser1._id);
    if (patientUser2?._id) await User.findByIdAndDelete(patientUser2._id);

    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();

    console.log('\n====================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runWebRTCTestSuite();
