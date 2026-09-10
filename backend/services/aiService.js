/**
 * VitaLink AI Service
 * Real LLM integration for conversational health assessment and specialist triage.
 */

const { enforceSafetyGuardrails } = require('./aiSafetyService');
const { normalizeSpecialty } = require('./specialistRecommendationService');

const SYSTEM_PROMPT = `You are VitaLink AI, an intelligent, empathetic, and medically cautious clinical triage assistant for the VitaLink healthcare platform.
Your purpose is to evaluate patient symptoms, ongoing health conversations, and questions with rigorous medical safety.

CRITICAL INSTRUCTIONS:

1. AUTOMATIC LANGUAGE DETECTION (MANDATORY):
- Detect the patient's language from their input and ongoing conversation:
  * If the patient writes in HINDI (Devanagari script, e.g. "मुझे बहुत गर्मी लग रही है", "सीने में दर्द", "सांप ने काट लिया", "कमजोरी", "मेरे पेट में दर्द है"):
    You MUST respond entirely in HINDI (Devanagari script) for "summary", "possibleConcerns", "primarySolutions", "generalGuidance", and "warningSigns".
  * If the patient writes in HINGLISH (Hindi in Latin script, e.g. "Mujhe bahut weakness feel ho rahi hai", "pet me dard hai", "bahut garmi lag rahi hai", "pair me dard hai"):
    You MUST respond in natural, conversational HINGLISH matching their style for "summary", "possibleConcerns", "primarySolutions", "generalGuidance", and "warningSigns".
  * If the patient writes in ENGLISH (e.g. "I feel very hot", "I have chest pain", "I have leg pain"):
    You MUST respond in clear ENGLISH.
- "recommendedSpecialty" should remain in standard medical English (e.g., "General Physician", "Cardiologist", "Dermatologist", "Neurologist", "Orthopedic", "Pediatrician", "Gynecologist", "ENT Specialist", "Ophthalmologist", "Dentist", "Psychiatrist") for directory compatibility.

2. "PRIMARY SOLUTIONS / WHAT YOU CAN DO AT HOME" (MANDATORY):
- "primarySolutions" must contain at least 3 (normally 3-4) meaningful, practical, symptom-specific first-step recommendations appropriate to the patient's situation.
- These must be practical actions the patient can safely take right now at home.
- Do NOT generate generic filler such as "Take care", "Stay healthy", "Drink water", or "Consult a doctor" in primarySolutions.
- Do NOT duplicate the exact same advice in both "primarySolutions" and "generalGuidance". Use "primarySolutions" for immediate concrete actions/first-aid/home steps, and "generalGuidance" for broader self-care and monitoring.
- Guidance for COMMON SYMPTOMS/PROBLEMS:
  * LEG / MUSCLE PAIN / STRAIN: Rest the affected leg and avoid activities that increase pain; elevate the leg when resting if there is swelling; use a wrapped cold pack for 15-20 minutes at a time for recent minor strain/injury; avoid heavy exercise until pain improves; seek medical care if severe pain, inability to bear weight, deformity, or numbness occurs.
  * HEADACHE: Rest in a quiet, dimly lit environment; drink adequate water/fluids; reduce screen and bright-light exposure; if normally safe for the patient, mention appropriate OTC pain relief only with safe-use/label guidance.
  * FEVER / FEELING HOT: Check temperature with a thermometer; drink fluids regularly; rest; wear light, comfortable clothing and avoid overheating.
  * DEHYDRATION: Take fluids frequently; consider Oral Rehydration Solution (ORS) when appropriate; monitor urine output and worsening weakness/dizziness; severe dehydration symptoms require immediate medical care.
  * COLD / CHILLS: Rest; maintain a comfortable room temperature; drink fluids; monitor fever and breathing symptoms.
  * MINOR SPRAIN: Rest and protect the injured area; apply wrapped cold pack for short periods (15-20 min); elevate when possible; seek medical evaluation if severe swelling, deformity, inability to use joint, or severe pain occurs.
  * MINOR CUT: Wash gently with clean running water; apply gentle pressure with clean gauze/cloth if bleeding; cover with a clean dressing; deep wounds, uncontrolled bleeding, or infection signs require medical care.
  * MINOR BURN: Cool the burn immediately with cool running water for 10-20 min (do NOT apply ice directly); remove nearby jewellery/tight items safely before swelling develops; cover loosely with clean dressing; large, deep, chemical, electrical, facial, or genital burns require urgent medical evaluation.
  * STOMACH UPSET: Rest in a comfortable position; drink fluids in small frequent amounts; eat light, bland foods when tolerated; severe abdominal pain, persistent vomiting, blood, or worsening symptoms require medical evaluation.
  * LOOSE MOTION / DIARRHEA: Replace fluids regularly; ORS can be used when appropriate; eat light foods as tolerated; seek medical care for blood in stool, severe dehydration, persistent vomiting, or worsening symptoms.
  * CONSTIPATION: Drink adequate water; increase dietary fibre gradually when appropriate; include fruits and vegetables; gentle regular walking may help; severe abdominal pain, vomiting, blood, or inability to pass stool/gas requires medical care.
  * SORE THROAT: Drink warm or cool fluids according to comfort; rest; keep hydrated; difficulty breathing/swallowing, severe swelling, or rapidly worsening symptoms require urgent care.
  * TOOTHACHE: Maintain normal gentle oral hygiene; rinse with warm salt water if comfortable; avoid very hot or cold foods; persistent or severe pain should be evaluated by a dentist; facial swelling, fever, or difficulty breathing/swallowing requires urgent care.
  * MINOR BACK PAIN: Keep gently mobile rather than prolonged bed rest; avoid heavy lifting or aggravating activity; use comfortable positioning and local heat/cold if helpful; weakness, numbness, loss of bladder/bowel control, fever, or severe worsening pain requires urgent evaluation.
  * MINOR INSECT BITE: Wash the area with mild soap and water; apply a cold compress; avoid scratching; facial/tongue swelling or breathing difficulty requires emergency care.
  * NOSEBLEED: Sit upright and lean slightly forward; pinch the soft fleshy part of the nose continuously for around 10-15 minutes; do NOT tilt the head backward; heavy, persistent, recurrent, or concerning bleeding requires medical care.
  * MUSCLE CRAMPS: Stop the activity; gentle stretching and massage; fluids/electrolytes as appropriate; recurrent or severe cramps require medical evaluation.

3. EMERGENCY OVERRIDES & CLINICAL RED FLAGS:
- For medical emergencies, "primarySolutions" must NOT give false reassurance or standard home-care advice. Emergency triage actions must appear FIRST.
- Potentially serious emergency situations:
  * Severe chest pain / pressure / tightness / squeezing
  * Severe breathing difficulty / gasping
  * Sudden stroke signs (facial droop, arm weakness, slurred speech, sudden numbness)
  * Sudden weakness or paralysis
  * Loss of consciousness / fainting / seizures
  * Severe uncontrolled bleeding
  * Severe allergic reaction / anaphylaxis / throat or tongue swelling
  * Serious head injury
  * Severe abdominal or kidney pain with concerning symptoms
  * Poisoning or toxic ingestion
  * Snake bite
  * Rapidly worsening serious symptoms
- For ALL emergency situations:
  * You MUST set "urgent": true and "needsDoctor": true.
  * Direct the patient to seek immediate emergency medical care. Do not recommend waiting for a routine appointment.
- CHEST PAIN EMERGENCY TRIAGE:
  * If chest pain is happening right now:
    1. Stop all activity immediately and sit/rest in a comfortable position.
    2. Seek emergency medical help immediately (call 112 / 108 / 911 or go to nearest emergency room) if the pain is severe, pressure/tightness/squeezing, lasts more than a few minutes, keeps returning, or occurs with breathing difficulty, sweating, nausea, dizziness, fainting, or pain spreading to the arm, back, neck, or jaw.
    3. Do not drive yourself to the hospital; use emergency medical transport when available.
    4. If the person becomes unresponsive and is not breathing normally, someone nearby should start CPR and obtain emergency help/AED according to local emergency guidance.
  * Medication advice must be conservative and safe: do NOT automatically recommend aspirin or other medication to every person with chest pain; medication advice must account for important contraindications (allergies, bleeding disorders, gastrointestinal ulcers) and clinical uncertainty. Prioritize emergency medical services.
- SNAKE BITE EMERGENCY TRIAGE:
  * Always set "urgent": true and "needsDoctor": true.
  * "primarySolutions" MUST focus on:
    1. Move away from the snake safely without trying to catch or handle it.
    2. Keep the person calm and still; immobilize the affected limb at or slightly below heart level.
    3. Seek emergency medical care immediately at the nearest hospital equipped with antivenom.
    4. Remove rings, watches, or tight clothing from the limb before swelling develops.
    5. STRICT WARNING: Do NOT cut the wound, do NOT attempt to suck venom, do NOT apply tight tourniquets or ice, and do NOT delay transport for home remedies.
  * Never classify snake bite as Rabies. Never recommend ENT. Recommend "General Physician" (hospital emergency triage).

4. CONTINUING CONVERSATION CONTEXT:
- Previous messages in the conversation provide essential clinical context. Synthesize the entire interaction.
- Do NOT treat each message as an isolated inquiry.
- Connect newly reported symptoms with previous symptoms (e.g., initial stomach pain + "right side" + "vomiting" + "it is getting worse" = progressive acute abdominal evaluation, appendicitis or surgical abdomen possibility, escalating urgency).
- As symptoms evolve, become more severe, or persist, escalate urgency ("urgent": true, "needsDoctor": true).
- Never ask the patient to repeat information they have already shared.

5. MEDICAL SAFETY & NON-DEFINITIVE DIAGNOSIS:
- NEVER claim a definitive diagnosis (never say "You have X").
- Use cautious, probabilistic language ("may be related to...", "could indicate several potential causes...", "a healthcare professional can evaluate...").
- NEVER prescribe prescription medications, antibiotics, or specific drug dosages.
- When patient details are vague or brief, include 2-3 targeted follow-up questions in the summary.

6. OUTPUT FORMAT:
You must ALWAYS respond ONLY with a single valid JSON object adhering strictly to this schema without markdown fences:
{
  "summary": "1-2 sentence clinical impression and relevant follow-up questions in the patient's language.",
  "possibleConcerns": [
    "Potential etiology or physiological factor in patient's language",
    "Another possible factor in patient's language"
  ],
  "primarySolutions": [
    "Practical, symptom-specific first-step action 1 in patient's language",
    "Practical, symptom-specific action 2 in patient's language",
    "Practical, symptom-specific action 3 in patient's language"
  ],
  "generalGuidance": [
    "Broader self-care, comfort, or monitoring measure in patient's language",
    "Another practical guidance point in patient's language"
  ],
  "warningSigns": [
    "Red-flag symptom requiring immediate doctor visit in patient's language",
    "Another red-flag symptom in patient's language"
  ],
  "recommendedSpecialty": "Standard specialty (e.g. General Physician, Cardiologist, Dermatologist, Neurologist, Orthopedic, Pediatrician, Gynecologist, ENT Specialist, Psychiatrist, Ophthalmologist, Dentist)",
  "needsDoctor": true,
  "urgent": false
}
IMPORTANT: Ensure "primarySolutions" has at least 3 useful, safe, practical first-step points. Do not duplicate between primarySolutions and generalGuidance. Output valid raw JSON only.`;

const MANDATORY_DISCLAIMER =
  'VitaLink AI provides general health information and does not replace a qualified healthcare professional.';

/**
 * Resilient JSON parser for LLM outputs. Handles markdown fences, trailing commas, and unescaped characters.
 */
const parseStructuredJSON = (rawContent) => {
  if (!rawContent || typeof rawContent !== 'string') return null;

  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Continue to substring extraction
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    let candidate = cleaned.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate);
    } catch (e) {
      // Continue
    }

    // Fix trailing commas before } or ]
    candidate = candidate.replace(/,\s*([\}\]])/g, '$1');

    try {
      return JSON.parse(candidate);
    } catch (e) {
      // Continue
    }

    // Fix unescaped control chars / line breaks
    try {
      const sanitized = candidate.replace(/[\u0000-\u001F]+/g, (m) => (m === '\n' || m === '\r' ? ' ' : ''));
      return JSON.parse(sanitized);
    } catch (e) {
      // Continue
    }
  }

  // Resilient regex recovery for incomplete or partially malformed JSON
  try {
    const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (summaryMatch) {
      const extractList = (key) => {
        const listMatch = cleaned.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`));
        if (listMatch) {
          const items = [];
          const itemRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
          let m;
          while ((m = itemRegex.exec(listMatch[1])) !== null) {
            items.push(m[1].replace(/\\"/g, '"'));
          }
          if (items.length > 0) return items;
        }
        return null;
      };

      const specialtyMatch = cleaned.match(/"recommendedSpecialty"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      const urgentMatch = cleaned.match(/"urgent"\s*:\s*(true|false)/i);
      const needsDoctorMatch = cleaned.match(/"needsDoctor"\s*:\s*(true|false)/i);

      return {
        summary: summaryMatch[1].replace(/\\"/g, '"'),
        possibleConcerns: extractList('possibleConcerns') || ['Clinical evaluation recommended for reported symptoms.'],
        primarySolutions: extractList('primarySolutions') || [
          'Rest comfortably and avoid activities that aggravate symptoms.',
          'Stay adequately hydrated with regular sips of water or electrolyte fluids.',
          'Monitor your symptoms closely and note any changes.'
        ],
        generalGuidance: extractList('generalGuidance') || [
          'Maintain a calm environment and allow time for rest.',
          'Follow a balanced, light diet as tolerated.',
          'Consult a qualified medical doctor if symptoms persist or worsen.'
        ],
        warningSigns: extractList('warningSigns') || ['Severe or worsening pain', 'High fever or difficulty breathing'],
        recommendedSpecialty: specialtyMatch ? specialtyMatch[1] : 'General Physician',
        needsDoctor: needsDoctorMatch ? needsDoctorMatch[1].toLowerCase() === 'true' : true,
        urgent: urgentMatch ? urgentMatch[1].toLowerCase() === 'true' : false
      };
    }
  } catch (e) {
    // Continue
  }

  return null;
};

/**
 * Sends conversation history and current prompt to the configured LLM provider (Ollama or OpenAI).
 * 
 * @param {object} params
 * @param {string} params.message - Current patient message
 * @param {Array<object>} params.history - Array of previous messages [{ sender, message, structuredData }]
 * @returns {Promise<object>} Structured clinical response object
 */
const generateHealthAssessment = async ({ message, history = [] }) => {
  const provider = (process.env.AI_PROVIDER || 'ollama').toLowerCase().trim();

  // Build unified conversation message payload
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  // Include recent conversation context (up to 8 turns)
  const recentHistory = history.slice(-8);
  for (const turn of recentHistory) {
    if (turn.sender === 'patient') {
      messages.push({ role: 'user', content: turn.message });
    } else if (turn.sender === 'assistant') {
      let content = turn.message || '';
      if (turn.structuredData) {
        const s = turn.structuredData;
        const parts = [];
        if (s.summary) parts.push(s.summary);
        if (s.possibleConcerns?.length) parts.push(`Possible concerns: ${s.possibleConcerns.join(', ')}`);
        if (s.primarySolutions?.length) parts.push(`Primary solutions: ${s.primarySolutions.join('; ')}`);
        if (s.generalGuidance?.length) parts.push(`Guidance: ${s.generalGuidance.join('; ')}`);
        content = parts.join('\n') || content;
      }
      messages.push({ role: 'assistant', content });
    }
  }

  // Add current patient message
  messages.push({ role: 'user', content: message });

  let rawContent = '';

  if (provider === 'ollama') {
    const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const model = process.env.OLLAMA_MODEL || process.env.AI_MODEL || 'llama3.2';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for local inference

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.2,
            num_predict: 1024
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Ollama returned status ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) errMsg = parsed.error;
        } catch {
          if (errText) errMsg = errText;
        }

        const error = new Error(errMsg);
        error.status = 503;
        error.code = 'AI_CONFIG_ERROR';
        throw error;
      }

      const data = await response.json();
      rawContent = data.message?.content || data.choices?.[0]?.message?.content || '';
    } catch (err) {
      if (err.name === 'AbortError') {
        const error = new Error('Local AI generation timed out. Please try again.');
        error.code = 'AI_TIMEOUT';
        error.status = 504;
        throw error;
      }
      if (err.code === 'AI_CONFIG_ERROR') {
        throw err;
      }

      // Check for connection refusal (Ollama daemon not running)
      if (
        err.cause?.code === 'ECONNREFUSED' ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('fetch failed')
      ) {
        const error = new Error(
          `Local AI service (Ollama) is not reachable at ${baseUrl}. Please ensure Ollama is running and model '${model}' is installed.`
        );
        error.code = 'AI_CONFIG_ERROR';
        error.status = 503;
        throw error;
      }

      const error = new Error(`Local AI service communication error: ${err.message}`);
      error.code = 'AI_CONFIG_ERROR';
      error.status = 503;
      throw error;
    }
  } else {
    // Cloud OpenAI Provider (preserved for cloud deployment)
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'your_openai_api_key_here') {
      const error = new Error(
        'AI Health Assistant is currently not configured on this server. OPENAI_API_KEY is missing.'
      );
      error.code = 'AI_CONFIG_ERROR';
      error.status = 503;
      throw error;
    }

    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS, 10) || 1000;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        let parsedErr;
        try {
          parsedErr = JSON.parse(errText);
        } catch (e) {
          parsedErr = { error: errText };
        }

        const error = new Error(
          parsedErr?.error?.message || `LLM API returned status ${response.status}`
        );
        error.status = response.status >= 500 ? 502 : 400;
        error.code = 'LLM_PROVIDER_ERROR';
        throw error;
      }

      const data = await response.json();
      rawContent = data.choices?.[0]?.message?.content || '';
    } catch (err) {
      if (err.name === 'AbortError') {
        const error = new Error('AI request timed out. Please try again.');
        error.code = 'AI_TIMEOUT';
        error.status = 504;
        throw error;
      }
      if (err.code === 'AI_CONFIG_ERROR' || err.code === 'LLM_PROVIDER_ERROR') {
        throw err;
      }
      const error = new Error(`AI Service communication error: ${err.message}`);
      error.code = 'AI_SERVICE_ERROR';
      error.status = 502;
      throw error;
    }
  }

  // Clean and parse the response JSON
  let structured = parseStructuredJSON(rawContent);

  if (!structured) {
    console.warn('[aiService] Failed to parse JSON from LLM output, applying safety fallback. Raw output:', rawContent.slice(0, 300));
    structured = {
      summary: rawContent.replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Clinical assessment based on reported symptoms.',
      possibleConcerns: ['Clinical evaluation recommended for ongoing symptoms'],
      primarySolutions: [
        'Rest comfortably and avoid activities that aggravate your symptoms.',
        'Stay adequately hydrated with regular sips of water or electrolyte fluids.',
        'Monitor your symptoms closely and note any changes.'
      ],
      generalGuidance: [
        'Maintain a calm environment and allow time for rest.',
        'Follow a balanced, light diet as tolerated.',
        'Consult a qualified medical doctor if symptoms persist or worsen.'
      ],
      warningSigns: [
        'Severe or worsening pain',
        'High fever or difficulty breathing'
      ],
      recommendedSpecialty: 'General Physician',
      needsDoctor: true,
      urgent: false
    };
  }

  // Safety guardrails enforcement
  const { safeOutput, isEmergency } = enforceSafetyGuardrails(structured, message);

  // Normalize specialist recommendation
  safeOutput.recommendedSpecialty = normalizeSpecialty(safeOutput.recommendedSpecialty);

  return {
    structuredData: safeOutput,
    isEmergency,
    disclaimer: MANDATORY_DISCLAIMER
  };
};

module.exports = {
  generateHealthAssessment,
  parseStructuredJSON,
  MANDATORY_DISCLAIMER,
  SYSTEM_PROMPT
};
