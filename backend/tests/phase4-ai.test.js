const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const { ROLES, SPECIALIZATIONS } = require('../config/constants');
const { generateToken } = require('../utils/jwt');
const { evaluateSafety, enforceSafetyGuardrails } = require('../services/aiSafetyService');
const { normalizeSpecialty, getSupportedSpecializations } = require('../services/specialistRecommendationService');

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

const runPhase4Tests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Phase 4 AI Health Assistant Tests       ');
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

  // Connect to database
  await connectDB();

  // Spin up ephemeral test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Runner] Ephemeral test server active on port ${port}\n`);

  const patientEmailA = `patient_a_${Date.now()}@vitalink.com`;
  const patientEmailB = `patient_b_${Date.now()}@vitalink.com`;
  const doctorEmail = `doctor_${Date.now()}@vitalink.com`;

  let patientUserA;
  let patientUserB;
  let doctorUser;
  let patientTokenA;
  let patientTokenB;
  let doctorToken;

  try {
    // ----------------------------------------------------
    // Section 1: AI Clinical Safety & Emergency Triage
    // ----------------------------------------------------
    console.log('--- Section 1: Clinical Safety Triage Service ---');

    const cardiacCheck = evaluateSafety('I have severe crushing chest pain radiating to my left arm');
    assert(
      cardiacCheck.isEmergency === true && cardiacCheck.emergencyType === 'CARDIAC_EMERGENCY',
      'Clinical safety flags acute cardiac chest pain radiating to left arm'
    );

    const respiratoryCheck = evaluateSafety('I am gasping for air and unable to breathe');
    assert(
      respiratoryCheck.isEmergency === true && respiratoryCheck.emergencyType === 'RESPIRATORY_DISTRESS',
      'Clinical safety flags severe respiratory distress / inability to breathe'
    );

    const strokeCheck = evaluateSafety('My father has face drooping and sudden slurred speech');
    assert(
      strokeCheck.isEmergency === true && strokeCheck.emergencyType === 'STROKE_SIGNS',
      'Clinical safety flags FAST acute stroke indicators'
    );

    const lossOfConsciousnessCheck = evaluateSafety('The patient passed out and lost consciousness suddenly');
    assert(
      lossOfConsciousnessCheck.isEmergency === true && lossOfConsciousnessCheck.emergencyType === 'LOSS_OF_CONSCIOUSNESS',
      'Clinical safety flags acute loss of consciousness'
    );

    const anaphylaxisCheck = evaluateSafety('My throat is swelling and I am wheezing after eating peanuts');
    assert(
      anaphylaxisCheck.isEmergency === true && anaphylaxisCheck.emergencyType === 'ANAPHYLAXIS',
      'Clinical safety flags acute anaphylaxis / airway swelling'
    );

    const nonEmergencyCheck = evaluateSafety('I have a mild runny nose and slight scratchy throat');
    assert(
      nonEmergencyCheck.isEmergency === false,
      'Clinical safety does not trigger emergency flags on non-urgent symptoms'
    );

    // Test safety enforcement on structured response
    const mockUnsafeResponse = {
      summary: 'Patient reports chest pain during exertion.',
      possibleConcerns: ['Angina'],
      generalGuidance: ['Rest comfortably'],
      warningSigns: [],
      recommendedSpecialty: 'Cardiologist',
      urgent: false,
      needsDoctor: false
    };
    const guarded = enforceSafetyGuardrails(mockUnsafeResponse, 'I have crushing chest tightness');
    assert(
      guarded.safeOutput.urgent === true &&
      guarded.safeOutput.needsDoctor === true &&
      guarded.safeOutput.generalGuidance.some(g => g.includes('EMERGENCY NOTICE')),
      'enforceSafetyGuardrails overrides urgent and needsDoctor to true for acute symptoms'
    );
    assert(
      Array.isArray(guarded.safeOutput.primarySolutions) &&
      guarded.safeOutput.primarySolutions.length >= 3 &&
      guarded.safeOutput.primarySolutions.some(s => s.toLowerCase().includes('emergency') || s.toLowerCase().includes('112') || s.toLowerCase().includes('cpr')),
      'enforceSafetyGuardrails populates primarySolutions with emergency triage steps for chest pain'
    );

    // ----------------------------------------------------
    // Section 2: Specialist Recommendation Normalization
    // ----------------------------------------------------
    console.log('\n--- Section 2: Specialist Recommendation Service ---');

    assert(
      normalizeSpecialty('Dermatology') === 'Dermatologist',
      'Normalizes "Dermatology" to official "Dermatologist"'
    );

    assert(
      normalizeSpecialty('cardiac care / heart specialist') === 'Cardiologist',
      'Normalizes heart specialist keywords to "Cardiologist"'
    );

    assert(
      normalizeSpecialty('orthopedic surgeon and bone fracture') === 'Orthopedic',
      'Normalizes bone and fracture keywords to "Orthopedic"'
    );

    assert(
      normalizeSpecialty('ear nose and throat clinic') === 'ENT Specialist',
      'Normalizes ENT keywords to "ENT Specialist"'
    );

    assert(
      normalizeSpecialty('completely unknown unmapped specialty') === 'General Physician',
      'Falls back safely to "General Physician" for ambiguous specialties'
    );

    const allSpecialties = getSupportedSpecializations();
    assert(
      Array.isArray(allSpecialties) && allSpecialties.includes('Cardiologist') && allSpecialties.includes('General Physician'),
      'getSupportedSpecializations returns the official VitaLink specialization catalog'
    );

    // ----------------------------------------------------
    // Section 3: API Authentication & Role Authorization
    // ----------------------------------------------------
    console.log('\n--- Section 3: Authentication & Role Authorization ---');

    // Create test users
    patientUserA = await User.create({
      fullName: 'Patient Alpha',
      email: patientEmailA,
      password: 'Password123!',
      phone: '9876500001',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      address: '123 Test Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      role: ROLES.PATIENT
    });
    patientTokenA = generateToken(patientUserA);

    patientUserB = await User.create({
      fullName: 'Patient Beta',
      email: patientEmailB,
      password: 'Password123!',
      phone: '9876500002',
      gender: 'female',
      dateOfBirth: new Date('1995-05-05'),
      address: '456 Second Street',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      role: ROLES.PATIENT
    });
    patientTokenB = generateToken(patientUserB);

    doctorUser = await User.create({
      fullName: 'Dr. Test Physician',
      email: doctorEmail,
      password: 'Password123!',
      phone: '9876500003',
      gender: 'other',
      dateOfBirth: new Date('1980-03-15'),
      address: '789 Clinic Road',
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      role: ROLES.DOCTOR
    });
    doctorToken = generateToken(doctorUser);

    // Test: Public specialist listing endpoint
    const specRes = await request(server, 'GET', '/api/v1/ai/specialists');
    assert(
      specRes.status === 200 && Array.isArray(specRes.data?.data) && specRes.data.data.length > 5,
      'GET /api/v1/ai/specialists is accessible and returns specialization list'
    );

    // Test: Unauthenticated request to /api/v1/ai/chat returns 401
    const unauthRes = await request(server, 'POST', '/api/v1/ai/chat', { message: 'I feel sick' });
    assert(
      unauthRes.status === 401,
      'Unauthenticated POST /api/v1/ai/chat is rejected with 401 Unauthorized'
    );

    // Test: Doctor role accessing /api/v1/ai/chat returns 403 Forbidden
    const doctorChatRes = await request(
      server,
      'POST',
      '/api/v1/ai/chat',
      { message: 'I have fever' },
      doctorToken
    );
    assert(
      doctorChatRes.status === 403,
      'Doctor role attempting to access Patient AI chat is rejected with 403 Forbidden'
    );

    // Test: Validation error on empty message
    const emptyMsgRes = await request(
      server,
      'POST',
      '/api/v1/ai/chat',
      { message: '   ' },
      patientTokenA
    );
    assert(
      emptyMsgRes.status === 400 && emptyMsgRes.data?.code === 'VALIDATION_ERROR',
      'Empty or whitespace-only message returns 400 VALIDATION_ERROR'
    );

    // ----------------------------------------------------
    // Section 4: Missing OPENAI_API_KEY Clean Handling
    // ----------------------------------------------------
    console.log('\n--- Section 4: Missing OpenAI Key Clean Handling ---');

    // Ensure that when OPENAI_API_KEY is missing or unconfigured, server returns 503 AI_CONFIG_ERROR without crashing
    const originalProvider = process.env.AI_PROVIDER;
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    const noKeyRes = await request(
      server,
      'POST',
      '/api/v1/ai/chat',
      { message: 'I feel weak and tired for 3 days' },
      patientTokenA
    );

    assert(
      noKeyRes.status === 503 && noKeyRes.data?.code === 'AI_CONFIG_ERROR',
      'When OPENAI_API_KEY is not set, returns 503 AI_CONFIG_ERROR cleanly without fabricating responses'
    );

    // Restore provider and key
    if (originalProvider) {
      process.env.AI_PROVIDER = originalProvider;
    } else {
      delete process.env.AI_PROVIDER;
    }
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }

    // ----------------------------------------------------
    // Section 5: Conversation Persistence & Patient Data Isolation
    // ----------------------------------------------------
    console.log('\n--- Section 5: Conversation CRUD & Patient Data Isolation ---');

    // Create Conversation directly for Patient A
    const conversationA = await AIConversation.create({
      patient: patientUserA._id,
      title: 'Headache and fatigue evaluation',
      suggestedSpecialty: 'General Physician'
    });

    // Create Messages for Conversation A
    const userMsgA = await AIMessage.create({
      conversation: conversationA._id,
      patient: patientUserA._id,
      sender: 'patient',
      message: 'I have had a throbbing headache and fatigue since yesterday.'
    });

    const assistantMsgA = await AIMessage.create({
      conversation: conversationA._id,
      patient: patientUserA._id,
      sender: 'assistant',
      message: 'Patient reports acute throbbing headache and generalized fatigue.',
      structuredData: {
        summary: 'Patient reports acute throbbing headache and generalized fatigue.',
        possibleConcerns: ['Tension Headache', 'Dehydration', 'Migraine'],
        generalGuidance: ['Hydrate adequately', 'Rest in a quiet, dark room'],
        warningSigns: ['Sudden explosive headache', 'Neck stiffness', 'Visual disturbances'],
        recommendedSpecialty: 'General Physician',
        needsDoctor: true,
        urgent: false
      },
      disclaimer: 'VitaLink AI provides general health information and does not replace a qualified healthcare professional.'
    });

    // Test: Patient A lists conversations
    const listResA = await request(server, 'GET', '/api/v1/ai/conversations', null, patientTokenA);
    assert(
      listResA.status === 200 &&
      listResA.data?.data?.some(c => c._id.toString() === conversationA._id.toString()),
      'Patient A can retrieve list of their own conversations'
    );

    // Test: Patient A fetches conversation by ID
    const getResA = await request(
      server,
      'GET',
      `/api/v1/ai/conversations/${conversationA._id}`,
      null,
      patientTokenA
    );
    assert(
      getResA.status === 200 &&
      getResA.data?.data?.conversation?._id.toString() === conversationA._id.toString() &&
      getResA.data?.data?.messages?.length === 2,
      'Patient A retrieves conversation detail along with all associated messages'
    );

    // Test: Patient A updates conversation title
    const updateResA = await request(
      server,
      'PATCH',
      `/api/v1/ai/conversations/${conversationA._id}`,
      { title: 'Updated: Throbbing Headache Notes' },
      patientTokenA
    );
    assert(
      updateResA.status === 200 && updateResA.data?.data?.title === 'Updated: Throbbing Headache Notes',
      'Patient A successfully updates conversation title'
    );

    // Test: Patient Isolation - Patient B attempts to fetch Patient A's conversation
    const getResB = await request(
      server,
      'GET',
      `/api/v1/ai/conversations/${conversationA._id}`,
      null,
      patientTokenB
    );
    assert(
      getResB.status === 404 && getResB.data?.code === 'CONVERSATION_NOT_FOUND',
      'Patient B cannot access Patient A conversation (isolation enforced, returns 404)'
    );

    // Test: Patient Isolation - Patient B attempts to update Patient A's conversation
    const updateResB = await request(
      server,
      'PATCH',
      `/api/v1/ai/conversations/${conversationA._id}`,
      { title: 'Hacked Title' },
      patientTokenB
    );
    assert(
      updateResB.status === 404 && updateResB.data?.code === 'CONVERSATION_NOT_FOUND',
      'Patient B cannot update Patient A conversation (isolation enforced, returns 404)'
    );

    // Test: Patient Isolation - Patient B attempts to delete Patient A's conversation
    const deleteResB = await request(
      server,
      'DELETE',
      `/api/v1/ai/conversations/${conversationA._id}`,
      null,
      patientTokenB
    );
    assert(
      deleteResB.status === 404 && deleteResB.data?.code === 'CONVERSATION_NOT_FOUND',
      'Patient B cannot delete Patient A conversation (isolation enforced, returns 404)'
    );

    // Test: Patient A deletes their own conversation
    const deleteResA = await request(
      server,
      'DELETE',
      `/api/v1/ai/conversations/${conversationA._id}`,
      null,
      patientTokenA
    );
    assert(
      deleteResA.status === 200,
      'Patient A successfully deletes their conversation'
    );

    // Verify messages cascading deletion
    const remainingMessages = await AIMessage.find({ conversation: conversationA._id });
    assert(
      remainingMessages.length === 0,
      'Deleting conversation cascades and deletes all associated messages'
    );

    // ----------------------------------------------------
    // Section 6: Security & Secrets Redaction
    // ----------------------------------------------------
    console.log('\n--- Section 6: Security & Secrets Redaction ---');

    const jsonStringA = JSON.stringify(getResA.data || {});
    const jsonStringSpec = JSON.stringify(specRes.data || {});
    const jsonStringNoKey = JSON.stringify(noKeyRes.data || {});

    const hasSecrets =
      jsonStringA.includes('MONGO_URI') ||
      jsonStringA.includes('JWT_SECRET') ||
      jsonStringSpec.includes('MONGO_URI') ||
      jsonStringNoKey.includes('mongodb://') ||
      jsonStringNoKey.includes('cluster0');

    assert(
      !hasSecrets,
      'Responses do not expose MONGO_URI, cluster connection details, or JWT_SECRET'
    );

    // Cleanup test users
    await User.deleteMany({
      email: { $in: [patientEmailA, patientEmailB, doctorEmail] }
    });
    console.log('\n[Test Runner] Cleaned up temporary test data.');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('[Test Runner] Ephemeral test server closed.');
    await disconnectDB();
  }

  console.log('====================================================');
  console.log(`Phase 4 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPhase4Tests().catch((err) => {
  console.error('[Phase 4 Fatal Error]:', err);
  process.exit(1);
});
