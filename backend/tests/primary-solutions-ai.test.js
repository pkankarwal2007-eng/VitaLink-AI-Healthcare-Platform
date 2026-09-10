const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { connectDB, disconnectDB } = require('../config/db');
const { enforceSafetyGuardrails } = require('../services/aiSafetyService');
const { parseStructuredJSON } = require('../services/aiService');

const runPrimarySolutionsTests = async () => {
  console.log('====================================================');
  console.log('  VitaLink AI Primary Solutions & Home Care Tests   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log('  [PASS] ' + message);
      passed++;
    } else {
      console.error('  [FAIL] ' + message);
      failed++;
    }
  };

  await connectDB();

  console.log('--- Scenario 1: "I have leg pain" ---');
  const legPainInput = 'I have leg pain';
  const legPainGuarded = enforceSafetyGuardrails({
    summary: 'Patient reports pain in the lower extremity.',
    possibleConcerns: ['Muscle strain', 'Overuse injury'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['Inability to bear weight', 'Severe swelling'],
    recommendedSpecialty: 'Orthopedic',
    urgent: false,
    needsDoctor: false
  }, legPainInput);

  assert(Array.isArray(legPainGuarded.safeOutput.primarySolutions), 'primarySolutions is an array');
  assert(legPainGuarded.safeOutput.primarySolutions.length >= 3, 'Has >= 3 primary solutions');
  assert(
    legPainGuarded.safeOutput.primarySolutions.some(s => /rest/i.test(s)) &&
    legPainGuarded.safeOutput.primarySolutions.some(s => /elevat/i.test(s)) &&
    legPainGuarded.safeOutput.primarySolutions.some(s => /cold pack|ice/i.test(s)),
    'Leg pain primary solutions contain rest, elevation, and cold pack guidance'
  );
  assert(legPainGuarded.safeOutput.urgent === false, 'Minor leg pain does not trigger false urgent emergency');

  console.log('\n--- Scenario 2: "I have chest pain" ---');
  const chestPainInput = 'I have chest pain';
  const chestPainGuarded = enforceSafetyGuardrails({
    summary: 'Patient experiencing chest pain.',
    possibleConcerns: ['Potential cardiac ischemia'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['Pain radiating to arm'],
    recommendedSpecialty: 'Cardiologist',
    urgent: true,
    needsDoctor: true
  }, chestPainInput);

  assert(chestPainGuarded.safeOutput.urgent === true, 'Chest pain sets urgent = true');
  assert(chestPainGuarded.safeOutput.needsDoctor === true, 'Chest pain sets needsDoctor = true');
  assert(chestPainGuarded.safeOutput.primarySolutions.length >= 3, 'Has >= 3 primary solutions');
  assert(
    chestPainGuarded.safeOutput.primarySolutions.some(s => /stop.*activity|rest/i.test(s)),
    'Primary solutions step 1 instructs to stop activity and rest'
  );
  assert(
    chestPainGuarded.safeOutput.primarySolutions.some(s => /112|108|911|emergency/i.test(s)),
    'Primary solutions step 2 directs emergency medical contact'
  );
  assert(
    chestPainGuarded.safeOutput.primarySolutions.some(s => /do not drive|transport/i.test(s)),
    'Primary solutions step 3 warns not to drive to hospital'
  );
  assert(
    chestPainGuarded.safeOutput.primarySolutions.some(s => /cpr/i.test(s)),
    'Primary solutions includes CPR instructions if unresponsive'
  );

  console.log('\n--- Scenario 3: "मुझे सीने में दर्द हो रहा है" (Hindi) ---');
  const hindiChestInput = 'मुझे सीने में दर्द हो रहा है';
  const hindiChestGuarded = enforceSafetyGuardrails({
    summary: 'मरीज को सीने में दर्द की शिकायत है।',
    possibleConcerns: ['हृदय संबंधी समस्या'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: [],
    recommendedSpecialty: 'Cardiologist',
    urgent: true,
    needsDoctor: true
  }, hindiChestInput);

  assert(hindiChestGuarded.safeOutput.urgent === true, 'Hindi chest pain sets urgent = true');
  assert(hindiChestGuarded.safeOutput.primarySolutions.length >= 3, 'Hindi chest pain has >= 3 primary solutions');
  assert(
    hindiChestGuarded.safeOutput.primarySolutions.some(s => /आपातकालीन|112|108/.test(s)),
    'Hindi primary solutions contain Devanagari emergency guidance'
  );
  assert(
    hindiChestGuarded.safeOutput.primarySolutions.some(s => /सीपीआर|CPR/.test(s)),
    'Hindi primary solutions include CPR guidance'
  );

  console.log('\n--- Scenario 4: "Mujhe bahut weakness feel ho rahi hai" (Hinglish) ---');
  const hinglishWeaknessInput = 'Mujhe bahut weakness feel ho rahi hai';
  const hinglishWeaknessGuarded = enforceSafetyGuardrails({
    summary: 'Patient ko kamzori aur thakan mehsoos ho rahi hai.',
    possibleConcerns: ['Dehydration', 'Nutritional deficiency'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['Chakkar aakar behosh hona'],
    recommendedSpecialty: 'General Physician',
    urgent: false,
    needsDoctor: true
  }, hinglishWeaknessInput);

  assert(hinglishWeaknessGuarded.safeOutput.primarySolutions.length >= 3, 'Hinglish weakness has >= 3 primary solutions');
  assert(
    hinglishWeaknessGuarded.safeOutput.primarySolutions.some(s => /aaram|rest/i.test(s)),
    'Hinglish primary solutions include rest / aaram'
  );
  assert(
    hinglishWeaknessGuarded.safeOutput.primarySolutions.some(s => /paani|ors|fluid/i.test(s)),
    'Hinglish primary solutions include hydration / paani / ORS'
  );

  console.log('\n--- Scenario 5: "I feel very hot" ---');
  const hotInput = 'I feel very hot';
  const hotGuarded = enforceSafetyGuardrails({
    summary: 'Patient reports feeling unusually hot.',
    possibleConcerns: ['Elevated ambient temperature', 'Mild fever', 'Dehydration'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['Confusion', 'Inability to sweat', 'Persistent high fever'],
    recommendedSpecialty: 'General Physician',
    urgent: false,
    needsDoctor: false
  }, hotInput);

  assert(hotGuarded.safeOutput.urgent === false, '"I feel very hot" does not trigger stroke or emergency false positive');
  assert(hotGuarded.safeOutput.primarySolutions.length >= 3, 'Feeling hot has >= 3 primary solutions');
  assert(
    hotGuarded.safeOutput.primarySolutions.some(s => /thermometer|temperature/i.test(s)),
    'Feeling hot advises checking body temperature with a thermometer'
  );
  assert(
    hotGuarded.safeOutput.primarySolutions.some(s => /water|hydrat|fluid/i.test(s)),
    'Feeling hot advises fluid hydration'
  );

  console.log('\n--- Scenario 6: "I have constipation" ---');
  const constipInput = 'I have constipation';
  const constipGuarded = enforceSafetyGuardrails({
    summary: 'Patient reports difficulty with bowel movements.',
    possibleConcerns: ['Dietary lack of fibre', 'Inadequate hydration'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['Severe abdominal pain', 'Blood in stool'],
    recommendedSpecialty: 'General Physician',
    urgent: false,
    needsDoctor: false
  }, constipInput);

  assert(constipGuarded.safeOutput.primarySolutions.length >= 3, 'Constipation has >= 3 primary solutions');
  assert(
    constipGuarded.safeOutput.primarySolutions.some(s => /water|fluid/i.test(s)),
    'Constipation advises drinking adequate water'
  );
  assert(
    constipGuarded.safeOutput.primarySolutions.some(s => /fibre|fiber|fruits|vegetables/i.test(s)),
    'Constipation advises dietary fibre'
  );
  assert(
    constipGuarded.safeOutput.primarySolutions.some(s => /walking|activity/i.test(s)),
    'Constipation advises gentle walking / activity'
  );

  console.log('\n--- Scenario 7: "I have a snake bite" ---');
  const snakeInput = 'I have a snake bite';
  const snakeGuarded = enforceSafetyGuardrails({
    summary: 'Patient suffered a snake bite on the leg.',
    possibleConcerns: ['Rabies infection'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['Swelling', 'Difficulty breathing'],
    recommendedSpecialty: 'ENT Specialist',
    urgent: true,
    needsDoctor: true
  }, snakeInput);

  assert(snakeGuarded.safeOutput.urgent === true, 'Snake bite sets urgent = true');
  assert(snakeGuarded.safeOutput.needsDoctor === true, 'Snake bite sets needsDoctor = true');
  assert(snakeGuarded.safeOutput.recommendedSpecialty === 'General Physician', 'Specialty corrected to General Physician (not ENT)');
  assert(!snakeGuarded.safeOutput.possibleConcerns.some(c => /rabies/i.test(c)), 'Hallucinated Rabies is cleansed');
  assert(
    snakeGuarded.safeOutput.primarySolutions.some(s => /immobiliz/i.test(s)),
    'Snake bite advises limb immobilization'
  );
  assert(
    snakeGuarded.safeOutput.primarySolutions.some(s => /antivenom|hospital/i.test(s)),
    'Snake bite advises immediate hospital transport with antivenom'
  );
  assert(
    snakeGuarded.safeOutput.primarySolutions.some(s => /not cut.*not.*suck|tourniquet/i.test(s)),
    'Snake bite warns against cutting, sucking, or tourniquets'
  );

  console.log('\n--- Scenario 8: "मेरे पेट में दर्द है" (Hindi) ---');
  const hindiStomachInput = 'मेरे पेट में दर्द है';
  const hindiStomachGuarded = enforceSafetyGuardrails({
    summary: 'मरीज पेट दर्द की शिकायत कर रहा है।',
    possibleConcerns: ['अपच', 'गैस्ट्राइटिस'],
    primarySolutions: [],
    generalGuidance: [],
    warningSigns: ['उल्टी में खून', 'असहनीय दर्द'],
    recommendedSpecialty: 'General Physician',
    urgent: false,
    needsDoctor: false
  }, hindiStomachInput);

  assert(hindiStomachGuarded.safeOutput.primarySolutions.length >= 3, 'Hindi stomach pain has >= 3 primary solutions');
  assert(
    hindiStomachGuarded.safeOutput.primarySolutions.some(s => /भोजन|पानी|आराम/.test(s)),
    'Hindi stomach pain contains Devanagari practical home care steps'
  );

  console.log('\n--- Scenario 9: Multi-Turn Conversation Context Synthesis ---');
  const turnHistory = 'I have stomach pain -> right side -> vomiting -> it is getting worse';
  const progressiveGuarded = enforceSafetyGuardrails({
    summary: 'Progressive right lower quadrant abdominal pain with vomiting and worsening severity.',
    possibleConcerns: ['Acute appendicitis', 'Peritoneal irritation', 'Acute surgical abdomen'],
    primarySolutions: [
      'Stop consuming solid foods and fluids immediately to keep the stomach empty if emergency surgery or evaluation is required.',
      'Rest comfortably and avoid applying heating pads or taking laxatives, which can worsen inflammation.',
      'Seek prompt medical evaluation at an emergency room or urgent care center immediately.'
    ],
    generalGuidance: [
      'Avoid pain medications before a physician evaluates the abdomen so symptoms are not masked.',
      'Have someone accompany you to the clinic or emergency hospital.'
    ],
    warningSigns: [
      'High fever or chills',
      'Inability to stand upright or walk',
      'Rigid or tender abdomen'
    ],
    recommendedSpecialty: 'General Physician',
    urgent: true,
    needsDoctor: true
  }, turnHistory);

  assert(progressiveGuarded.safeOutput.urgent === true, 'Worsening right-sided abdominal pain with vomiting escalates urgent = true');
  assert(progressiveGuarded.safeOutput.needsDoctor === true, 'Progressive abdominal pain sets needsDoctor = true');
  assert(progressiveGuarded.safeOutput.primarySolutions.length >= 3, 'Progressive pain has >= 3 primary solutions');
  assert(
    progressiveGuarded.safeOutput.possibleConcerns.some(c => /appendicitis|surgical abdomen/i.test(c)),
    'Combined multi-turn context correctly evaluates acute appendicitis / surgical abdomen'
  );

  console.log('\n--- Scenario 10: Resilient JSON Parser for primarySolutions ---');
  const rawLLMOutput = '{"summary":"Minor sprain.","possibleConcerns":["Sprain"],"primarySolutions":["Rest the joint.","Apply cold pack 15-20 min.","Elevate when resting."],"generalGuidance":["Allow time for recovery."],"warningSigns":["Deformity"],"recommendedSpecialty":"Orthopedic","needsDoctor":false,"urgent":false}';
  const parsed = parseStructuredJSON(rawLLMOutput);
  assert(parsed !== null, 'parseStructuredJSON parses output');
  assert(Array.isArray(parsed.primarySolutions), 'parsed.primarySolutions is an array');
  assert(parsed.primarySolutions.length === 3, 'parsed.primarySolutions has 3 items');
  assert(parsed.primarySolutions[0] === 'Rest the joint.', 'First primary solution matches');

  console.log('\n--- Scenario 11: Deduplication between primarySolutions and generalGuidance ---');
  const duplicateGuarded = enforceSafetyGuardrails({
    summary: 'Mild headache.',
    possibleConcerns: ['Tension headache'],
    primarySolutions: [
      'Rest in a quiet, dimly lit, and peaceful environment.',
      'Drink an adequate amount of water to ensure hydration.',
      'Reduce screen time and avoid exposure to bright or glaring lights.'
    ],
    generalGuidance: [
      'Rest in a quiet, dimly lit, and peaceful environment.',
      'Maintain a calm atmosphere.'
    ],
    warningSigns: ['Sudden explosive pain'],
    recommendedSpecialty: 'General Physician',
    urgent: false,
    needsDoctor: false
  }, 'I have a headache');

  const duplicateInGuidance = duplicateGuarded.safeOutput.generalGuidance.some(
    g => g === 'Rest in a quiet, dimly lit, and peaceful environment.'
  );
  assert(!duplicateInGuidance, 'Duplicate items between primarySolutions and generalGuidance are pruned');
  assert(duplicateGuarded.safeOutput.generalGuidance.length >= 1, 'generalGuidance maintains distinct self-care items');

  await disconnectDB();

  console.log('\n====================================================');
  console.log('Primary Solutions Tests: ' + passed + ' Passed, ' + failed + ' Failed');
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runPrimarySolutionsTests().catch((err) => {
  console.error('[Primary Solutions Tests Fatal Error]:', err);
  process.exit(1);
});
