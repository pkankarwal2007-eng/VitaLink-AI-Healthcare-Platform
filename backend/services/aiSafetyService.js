/**
 * VitaLink AI Clinical Safety & Emergency Triage Service
 * Enforces emergency guardrails for life-threatening medical conditions.
 */

const EMERGENCY_PATTERNS = [
  {
    type: 'SNAKE_BITE',
    label: 'Potential Snake Bite / Envenomation',
    regex: /\b(snake\s*bite|bitten by (a )?snake|bite by snake|snake envenomation|saan?p ne kaat|saap ne kaat)\b|सांप ने काट|सर्पदंश|सांप का काटना/i,
    immediateAction: 'Seek immediate emergency medical evaluation at the nearest hospital equipped with antivenom. Keep the affected limb immobilized at or slightly below heart level. Do NOT cut the wound, attempt to suck venom, or apply tight tourniquets.'
  },
  {
    type: 'CARDIAC_EMERGENCY',
    label: 'Suspected Acute Cardiac Event / Heart Attack',
    regex: /\b(chest pain|crushing chest|chest tightness|chest pressure|heart attack|pain radiating to (left )?arm|pain in jaw and chest|crushing pressure in chest|seene me(in)? (tez )?dard|chhati me(in)? (tez )?dard|dil ka daura)\b|सीने में (तेज़ )?दर्द|छाती में (तेज़ )?दर्द/i,
    immediateAction: 'Call emergency services (112 / 108 / 911) or proceed immediately to the nearest emergency department. Do NOT drive yourself.'
  },
  {
    type: 'RESPIRATORY_DISTRESS',
    label: 'Severe Respiratory Distress / Airway Obstruction',
    regex: /\b(can'?t breathe|unable to breathe|gasping for air|severe shortness of breath|choking|blue lips|turning blue|suffocating|struggling to breathe|saans lene me(in)? (bahut )?(takleef|dikkat|pareshani)|dum ghut)\b/i,
    immediateAction: 'Seek immediate emergency medical care. Sit upright and call emergency services without delay.'
  },
  {
    type: 'STROKE_SIGNS',
    label: 'Suspected Acute Stroke (FAST)',
    regex: /(?<!heat\s+|sun\s*)\bstroke\b|\b(face drooping|facial droop|slurred speech|sudden weakness on one side|sudden numbness in arm|can'?t move one side of body|sudden loss of vision|brain stroke|paralytic stroke|ischemic stroke|lakwa)\b/i,
    immediateAction: 'Act FAST. Time is critical for stroke treatment. Call emergency medical services immediately.'
  },
  {
    type: 'LOSS_OF_CONSCIOUSNESS',
    label: 'Loss of Consciousness / Unresponsive / Seizure',
    regex: /\b(passed out|lost consciousness|unresponsive|blacked out|ongoing seizure|convulsion|fainted and won'?t wake up|behosh(i)?|chakkar kha kar gir)\b/i,
    immediateAction: 'Call emergency services immediately. Ensure the person is in a safe recovery position and keep airway clear.'
  },
  {
    type: 'SEVERE_HEMORRHAGE',
    label: 'Severe Bleeding / Hemorrhage',
    regex: /\b(coughing (up )?blood|vomiting blood|gushing blood|uncontrolled bleeding|severe arterial bleeding|stab wound|gunshot|khoon ka bahaav|khoon ki ulti)\b/i,
    immediateAction: 'Apply firm direct pressure with a clean cloth and call emergency services immediately.'
  },
  {
    type: 'ANAPHYLAXIS',
    label: 'Severe Allergic Reaction (Anaphylaxis)',
    regex: /\b(anaphylaxis|throat (is )?swelling|tongue (is )?swelling|swollen throat can'?t swallow|severe allergic reaction and wheezing)\b/i,
    immediateAction: 'If an epinephrine auto-injector (EpiPen) is available, administer it immediately and call emergency services.'
  },
  {
    type: 'SELF_HARM',
    label: 'Acute Self-Harm / Crisis',
    regex: /\b(want to kill myself|commit suicide|end my life|take all my pills|slit my wrists|suicidal thoughts|jaan dena chahta|aatmhatya)\b/i,
    immediateAction: 'Please reach out for immediate support. Call your national suicide/crisis helpline (Tele-MANAS: 14416 or 1-800-891-4416 in India, 988 in the US/Canada) or visit an emergency room.'
  },
  {
    type: 'THUNDERCLAP_HEADACHE',
    label: 'Sudden Explosive Severe Headache',
    regex: /\b(worst headache of my life|thunderclap headache|sudden explosive headache|headache with stiff neck and high fever)\b/i,
    immediateAction: 'Seek emergency medical evaluation immediately to rule out intracranial hemorrhage or acute meningitis.'
  }
];

/**
 * Evaluate user input text for clinical red flags and life-threatening emergencies.
 * @param {string} text - User message or description
 * @returns {object} Safety evaluation outcome
 */
const evaluateSafety = (text) => {
  if (!text || typeof text !== 'string') {
    return {
      isEmergency: false,
      emergencyType: null,
      warningReasons: [],
      immediateAction: null
    };
  }

  const matches = [];

  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.regex.test(text)) {
      matches.push({
        type: pattern.type,
        label: pattern.label,
        immediateAction: pattern.immediateAction
      });
    }
  }

  if (matches.length > 0) {
    const primary = matches[0];
    return {
      isEmergency: true,
      emergencyType: primary.type,
      warningReasons: matches.map(m => m.label),
      immediateAction: primary.immediateAction
    };
  }

  return {
    isEmergency: false,
    emergencyType: null,
    warningReasons: [],
    immediateAction: null
  };
};

/**
 * Enforce clinical safety guardrails on the final structured response.
 * If either the patient query or the structured AI response indicates urgent risk,
 * guarantees that urgent: true, needsDoctor: true, and red-flag alerts are present.
 * 
 * @param {object} structured - The structured output from the LLM
 * @param {string} patientText - Original patient message
 * @returns {object} Safety-guarded structured output
 */
const enforceSafetyGuardrails = (structured, patientText = '') => {
  const safetyFromText = evaluateSafety(patientText);
  const safetyFromSummary = evaluateSafety(structured?.summary || '');
  const safetyFromConcerns = evaluateSafety((structured?.possibleConcerns || []).join(' '));

  const isEmergency =
    safetyFromText.isEmergency ||
    safetyFromSummary.isEmergency ||
    safetyFromConcerns.isEmergency ||
    structured?.urgent === true;

  // Language detection
  const isHindi = /[\u0900-\u097F]/.test(patientText) || /[\u0900-\u097F]/.test(structured?.summary || '');
  const isHinglish = /\b(mujhe|bahut|dard|lag raha|hai|ho rahi|ho raha|karein|jayein|pet|seene|bukhar|saap|saanp)\b/i.test(patientText);

  let defaultEmergencyAction = 'Seek immediate emergency medical attention at the nearest hospital or call local emergency services (112 / 108 / 911).';
  if (isHindi) {
    defaultEmergencyAction = 'तुरंत नजदीकी अस्पताल के आपातकालीन विभाग (Emergency) जाएं या आपातकालीन सेवाओं (112 / 108) को कॉल करें।';
  } else if (isHinglish) {
    defaultEmergencyAction = 'Turant nazdeeki hospital ke emergency department jayein ya emergency services (112 / 108) ko call karein.';
  }

  const activeImmediateAction =
    safetyFromText.immediateAction ||
    safetyFromSummary.immediateAction ||
    safetyFromConcerns.immediateAction ||
    defaultEmergencyAction;

  const safeOutput = {
    summary: structured?.summary || (isHindi ? 'सामान्य स्वास्थ्य मूल्यांकन।' : 'General health evaluation.'),
    possibleConcerns: Array.isArray(structured?.possibleConcerns) ? [...structured.possibleConcerns] : [],
    primarySolutions: Array.isArray(structured?.primarySolutions) ? [...structured.primarySolutions] : [],
    generalGuidance: Array.isArray(structured?.generalGuidance) ? [...structured.generalGuidance] : [],
    warningSigns: Array.isArray(structured?.warningSigns) ? [...structured.warningSigns] : [],
    recommendedSpecialty: structured?.recommendedSpecialty || 'General Physician',
    needsDoctor: structured?.needsDoctor !== undefined ? Boolean(structured.needsDoctor) : true,
    urgent: isEmergency
  };

  // Specific Snake Bite Guardrails: Remove hallucinated Rabies / ENT & Enforce Emergency Protocol
  const isSnakeBite =
    safetyFromText.emergencyType === 'SNAKE_BITE' ||
    /\b(snake\s*bite|bite by snake|bitten by snake|saan?p)\b/i.test(patientText) ||
    /\b(snake\s*bite|bitten by snake)\b/i.test(structured?.summary || '');

  if (isSnakeBite) {
    safeOutput.urgent = true;
    safeOutput.needsDoctor = true;

    // Purge Rabies / ENT hallucinations
    safeOutput.possibleConcerns = safeOutput.possibleConcerns.filter(
      c => !/rabies/i.test(c)
    );
    if (!safeOutput.possibleConcerns.some(c => /snake|envenomation|toxin|venom|डंक|दंश/i.test(c))) {
      safeOutput.possibleConcerns.unshift(
        isHindi ? 'सर्पदंश एवं विष प्रभाव (Snake Envenomation)' : 'Potential Snake Envenomation & Tissue Toxicity'
      );
    }
    safeOutput.recommendedSpecialty = 'General Physician';

    // Emergency primary actions for snake bite
    if (isHindi) {
      safeOutput.primarySolutions = [
        'सांप से तुरंत सुरक्षित दूरी बनाएं; मरीज को शांत और पूरी तरह स्थिर रखें ताकि विष का फैलाव धीमा रहे।',
        'दंश वाले अंग को हृदय के स्तर से नीचे या बराबर रखें और उसे स्थिर (immobilize) करें (स्प्लिंट या स्लिंग का उपयोग करें)।',
        'बिना किसी देरी के तुरंत निकटतम ऐसे अस्पताल के आपातकालीन विभाग जाएं जहां एंटीवेनम (Antivenom) उपलब्ध हो।',
        'अंग में सूजन आने से पहले अंगूठी, घड़ी और तंग कपड़े तुरंत उतार दें।',
        'कड़ी चेतावनी: घाव को न काटें, न चूसें, और न ही कोई कड़ा टूर्निकेट (tourniquet) या बर्फ लगाएं।'
      ];
    } else if (isHinglish) {
      safeOutput.primarySolutions = [
        'Snake se safe distance banayein; patient ko bilkul calm aur still rakhein taaki venom spread slow ho.',
        'Bitten limb ko heart level se thoda neeche rakhein aur usse immobilize karein (splint ya sling ka use karein).',
        'Turant nazdeeki hospital ke emergency department jayein jahan antivenom uplabdh ho.',
        'Swelling start hone se pehle rings, watch aur tight kapde nikaal dein.',
        'Kadi chetavni: Ghaav ko na kaatein, na chusein, aur na hi tight tourniquet ya baraf lagayein.'
      ];
    } else {
      safeOutput.primarySolutions = [
        'Move away from the snake safely without attempting to catch or handle it; keep the person calm and completely still to slow venom spread.',
        'Immobilize the affected limb at or slightly below heart level (using a splint or sling if practical).',
        'Seek emergency medical care immediately at the nearest hospital equipped with antivenom.',
        'Remove rings, watches, and tight clothing from the bitten limb before swelling develops.',
        'STRICT WARNING: Do NOT cut the wound, do NOT attempt to suck venom, do NOT apply tight tourniquets or ice, and do NOT delay transport for home remedies.'
      ];
    }
  }

  // Specific Cardiac Emergency / Chest Pain Guardrails: Enforce Emergency Triage First
  const isCardiacEmergency =
    safetyFromText.emergencyType === 'CARDIAC_EMERGENCY' ||
    /\b(chest pain|crushing chest|chest pressure|chest tightness|seene me(in)? (tez )?dard|chhati me(in)? (tez )?dard|dil ka daura)\b|सीने में (तेज़ )?दर्द|छाती में (तेज़ )?दर्द/i.test(patientText) ||
    /\b(chest pain|crushing chest|angina)\b|सीने में दर्द/i.test(structured?.summary || '');

  if (isCardiacEmergency) {
    safeOutput.urgent = true;
    safeOutput.needsDoctor = true;
    safeOutput.recommendedSpecialty = 'Cardiologist';

    if (isHindi) {
      safeOutput.primarySolutions = [
        'तुरंत सभी शारीरिक गतिविधियां रोकें और आरामदायक स्थिति में बैठें या आराम करें।',
        'यदि सीने में तेज दर्द, दबाव, भारीपन, सांस लेने में तकलीफ, पसीना या दर्द हाथ, गर्दन, पीठ या जबड़े में फैल रहा हो, तो तुरंत आपातकालीन सेवाओं (112 / 108) को कॉल करें या नजदीकी इमरजेंसी अस्पताल जाएं।',
        'अस्पताल खुद गाड़ी चलाकर न जाएं; आपातकालीन एम्बुलेंस या किसी अन्य व्यक्ति की परिवहन सहायता लें।',
        'यदि व्यक्ति बेहोश हो जाए और सामान्य रूप से सांस न ले रहा हो, तो तुरंत सीपीआर (CPR) शुरू करें और आपातकालीन सहायता बुलाएं।'
      ];
    } else if (isHinglish) {
      safeOutput.primarySolutions = [
        'Turant saari physical activities rokein aur aaramdayak position me baith jayein.',
        'Agar seene me tez dard, pressure, saans lene me dikkat, paseena ya dard baazu/peeth/jaw me fail raha hai to turant emergency services (112 / 108) ko call karein ya emergency room jayein.',
        'Hospital khud drive karke na jayein; emergency medical transport ya kisi aur ki madad lein.',
        'Agar vyakti behosh ho jaye aur normal saans na le raha ho to pass ke log turant CPR shuru karein aur emergency madad bulayein.'
      ];
    } else {
      safeOutput.primarySolutions = [
        'Stop all physical activity immediately and rest in a comfortable, supported seated position.',
        'Seek emergency medical help immediately (call 112 / 108 / 911 or go to the nearest emergency room) if pain is severe, pressure/tightness/squeezing, lasts more than a few minutes, keeps returning, or occurs with breathlessness, sweating, nausea, dizziness, or pain radiating to the arm, back, neck, or jaw.',
        'Do NOT drive yourself to the hospital; use emergency medical transport or have someone transport you immediately.',
        'If the person becomes unresponsive and is not breathing normally, someone nearby should start CPR and obtain emergency help/AED according to local emergency protocols.'
      ];
    }
  }

  if (isEmergency) {
    safeOutput.urgent = true;
    safeOutput.needsDoctor = true;

    // Ensure immediate emergency action is clearly present in guidance
    const emergencyPrefix = isHindi ? 'आपातकालीन सूचना:' : 'EMERGENCY NOTICE:';
    const hasEmergencyNotice = safeOutput.generalGuidance.some(
      g => g.includes('112') || g.includes('108') || g.includes('911') || g.includes('emergency') || g.includes('आपातकालीन')
    );

    if (!hasEmergencyNotice) {
      safeOutput.generalGuidance.unshift(`${emergencyPrefix} ${activeImmediateAction}`);
    }

    // Ensure red flags are clearly articulated
    if (safetyFromText.warningReasons.length > 0) {
      safetyFromText.warningReasons.forEach(reason => {
        if (!safeOutput.warningSigns.some(w => w.toLowerCase().includes(reason.toLowerCase()))) {
          const indicatorPrefix = isHindi ? 'महत्वपूर्ण चेतावनी:' : 'Critical Indicator:';
          safeOutput.warningSigns.unshift(`${indicatorPrefix} ${reason}`);
        }
      });
    }

    // If other emergency and primarySolutions empty, populate with emergency action
    if (safeOutput.primarySolutions.length === 0 && !isCardiacEmergency && !isSnakeBite) {
      safeOutput.primarySolutions.push(activeImmediateAction);
    }
  }

  // Symptom-specific practical recommendations when primarySolutions has fewer than 3 items
  if (safeOutput.primarySolutions.length < 3) {
    const textLower = (patientText + ' ' + (structured?.summary || '')).toLowerCase();

    if (/\b(leg pain|pain in leg|calf pain|thigh pain|muscle pain|pair me(in)? dard|taang me(in)? dard)\b/i.test(textLower)) {
      if (isHindi) {
        safeOutput.primarySolutions = [
          'प्रभावित पैर को आराम दें और ऐसी गतिविधियों से बचें जिनसे दर्द बढ़ता हो।',
          'यदि पैर में सूजन हो तो आराम करते समय पैर को तकिए के सहारे थोड़ा ऊपर (elevate) रखें।',
          'हालिया हल्की चोट या मांसपेशियों के खिंचाव के लिए कपड़े में लपेटकर 15-20 मिनट तक कोल्ड पैक लगाएं।',
          'दर्द में सुधार होने तक भारी व्यायाम या तेज दौड़ने से पूरी तरह बचें।'
        ];
      } else if (isHinglish) {
        safeOutput.primarySolutions = [
          'Affected pair ko aaram dein aur dard badhane wali activities avoid karein.',
          'Agar sujan (swelling) ho to aaram karte waqt pair ko thoda upar (elevate) rakhein.',
          'Recent minor strain ya chot ke liye kapde me lapetkar 15-20 minute tak cold pack lagayein.',
          'Dard theek hone tak heavy exercise ya running avoid karein.'
        ];
      } else {
        safeOutput.primarySolutions = [
          'Rest the affected leg and avoid activities that increase the pain.',
          'Elevate the leg when resting if there is swelling present.',
          'Use a wrapped cold pack for about 15–20 minutes at a time for a recent minor injury or muscle strain.',
          'Avoid heavy exercise and strenuous exertion until the pain improves.'
        ];
      }
    } else if (/\b(constipat\w*|kabz|hard stool)\b/i.test(textLower)) {
      if (isHindi) {
        safeOutput.primarySolutions = [
          'मल को नरम करने में सहायता के लिए पूरे दिन पर्याप्त मात्रा में पानी पिएं।',
          'आहार में फाइबर की मात्रा धीरे-धीरे बढ़ाएं, जैसे ताजे फल, हरी सब्जियां और साबुत अनाज।',
          'पाचन क्रिया को सक्रिय रखने के लिए रोजाना नियमित रूप से हल्की चहलकदमी करें।'
        ];
      } else if (isHinglish) {
        safeOutput.primarySolutions = [
          'Din bhar paryapt paani pijiye taaki stool soft rahe aur digestion smooth ho.',
          'Dietary fibre badhayein, jaise taaza fruits, green vegetables aur whole grains.',
          'Digestion active rakhne ke liye gentle regular walking karein.'
        ];
      } else {
        safeOutput.primarySolutions = [
          'Drink adequate water throughout the day to support normal digestive motility.',
          'Gradually increase dietary fibre by including whole fruits, vegetables, and whole grains.',
          'Engage in gentle regular physical activity like daily walking to stimulate bowel motility.'
        ];
      }
    } else if (/\b(very hot|feeling hot|bukhar|fever|garmi lag)\b/i.test(textLower) && !isCardiacEmergency) {
      if (isHindi) {
        safeOutput.primarySolutions = [
          'सटीक रीडिंग प्राप्त करने के लिए थर्मामीटर से अपने शरीर का तापमान मापें।',
          'हाइड्रेटेड रहने के लिए नियमित अंतराल पर पानी और तरल पदार्थों का सेवन करें।',
          'हल्के, ढीले और आरामदायक सूती कपड़े पहनें तथा अत्यधिक गर्मी से बचें।'
        ];
      } else if (isHinglish) {
        safeOutput.primarySolutions = [
          'Accurate reading lene ke liye thermometer se body temperature check karein.',
          'Hydration banaye rakhne ke liye regular intervals par paani aur fluids pijiye.',
          'Light aur comfortable kapde pehnein aur overheating se bachein.'
        ];
      } else {
        safeOutput.primarySolutions = [
          'Check your body temperature with a thermometer to obtain an objective reading.',
          'Drink water or electrolyte-rich fluids regularly to maintain hydration.',
          'Rest comfortably in a cool, well-ventilated space wearing light, breathable clothing.'
        ];
      }
    } else if (/\b(weak|weakness|tired|fatigue|kamzori)\b/i.test(textLower)) {
      if (isHindi) {
        safeOutput.primarySolutions = [
          'आरामदायक स्थिति में विश्राम करें और चक्कर आने से बचने के लिए धीरे-धीरे खड़े हों।',
          'पानी, नींबू-पानी या ओआरएस (ORS) जैसे तरल पदार्थों का नियमित सेवन करें।',
          'सुपाच्य और पौष्टिक हल्का भोजन नियमित अंतराल पर लें।'
        ];
      } else if (isHinglish) {
        safeOutput.primarySolutions = [
          'Aaram karein aur chakkar se bachne ke liye sudden physical movement avoid karein.',
          'Paani, ORS ya electrolyte fluids regular intervals par sip karein.',
          'Light aur nutritious meals regular intervals par lein.'
        ];
      } else {
        safeOutput.primarySolutions = [
          'Rest comfortably and avoid abrupt postural changes to prevent dizziness.',
          'Hydrate with water or electrolyte fluids in small, frequent sips.',
          'Consume small, easily digestible, nutrient-dense meals throughout the day.'
        ];
      }
    } else if (/\b(stomach pain|pet me(in)? dard|abdominal pain|cramps in stomach)\b/i.test(textLower)) {
      if (isHindi) {
        safeOutput.primarySolutions = [
          'आरामदायक स्थिति में बैठें या आराम करें और भारी भोजन से बचें।',
          'थोड़ी-थोड़ी मात्रा में बार-बार पानी या हल्का तरल पदार्थ पिएं।',
          'जब भूख लगे तब सुपाच्य और हल्का भोजन (जैसे खिचड़ी, केला, दलिया) ही लें।'
        ];
      } else if (isHinglish) {
        safeOutput.primarySolutions = [
          'Aaramdayak position me rest karein aur heavy meals avoid karein.',
          'Thodi-thodi matra me paani ya clear fluids sip karein.',
          'Tolerate hone par light aur easy-to-digest khana (jaise khichdi ya toast) lein.'
        ];
      } else {
        safeOutput.primarySolutions = [
          'Rest in a comfortable, relaxed position and avoid heavy or greasy foods.',
          'Sip water or clear fluids in small, frequent amounts to stay hydrated.',
          'Eat bland, easily tolerated foods (crackers, rice, toast) when appetite allows.'
        ];
      }
    } else if (/\b(headache|sar dard|head pain)\b/i.test(textLower)) {
      if (isHindi) {
        safeOutput.primarySolutions = [
          'शांत और कम रोशनी वाले कमरे में आराम करें।',
          'पर्याप्त मात्रा में पानी पिएं और शरीर को हाइड्रेटेड रखें।',
          'मोबाइल, कंप्यूटर स्क्रीन और तेज रोशनी के संपर्क को कम करें।'
        ];
      } else if (isHinglish) {
        safeOutput.primarySolutions = [
          'Shaant aur dim-light wale room me aaram karein.',
          'Paryapt paani pijiye aur hydration banaye rakhein.',
          'Mobile, laptop screens aur bright lights ka exposure kam karein.'
        ];
      } else {
        safeOutput.primarySolutions = [
          'Rest in a quiet, dimly lit, and peaceful environment.',
          'Drink an adequate amount of water to ensure hydration.',
          'Reduce screen time and avoid exposure to bright or glaring lights.'
        ];
      }
    }
  }

  // Ensure AT LEAST 3 meaningful primary solutions
  if (safeOutput.primarySolutions.length < 3) {
    if (isHindi) {
      const hindiSolFallbacks = [
        'लक्षणों को बढ़ाने वाली गतिविधियों से बचें और आरामदायक स्थिति में विश्राम करें।',
        'पानी या इलेक्ट्रोलाइट तरल पदार्थों का नियमित रूप से सेवन करें।',
        'अपने लक्षणों पर बारीकी से नज़र रखें और किसी भी नए बदलाव को नोट करें।'
      ];
      for (const fb of hindiSolFallbacks) {
        if (safeOutput.primarySolutions.length >= 3) break;
        if (!safeOutput.primarySolutions.includes(fb)) safeOutput.primarySolutions.push(fb);
      }
    } else if (isHinglish) {
      const hinglishSolFallbacks = [
        'Symptoms badhane wali activities se bachein aur aaram karein.',
        'Regular intervals par paani ya electrolyte fluids peete rahein.',
        'Apne symptoms ko dhyan se monitor karein aur kisi badlav ko note karein.'
      ];
      for (const fb of hinglishSolFallbacks) {
        if (safeOutput.primarySolutions.length >= 3) break;
        if (!safeOutput.primarySolutions.includes(fb)) safeOutput.primarySolutions.push(fb);
      }
    } else {
      const englishSolFallbacks = [
        'Rest comfortably and avoid physical activities that aggravate your symptoms.',
        'Stay adequately hydrated with regular sips of water or electrolyte fluids.',
        'Monitor your symptoms closely and note any changing patterns or severity.'
      ];
      for (const fb of englishSolFallbacks) {
        if (safeOutput.primarySolutions.length >= 3) break;
        if (!safeOutput.primarySolutions.includes(fb)) safeOutput.primarySolutions.push(fb);
      }
    }
  }

  // Ensure AT LEAST 3 meaningful guidance points
  if (safeOutput.generalGuidance.length < 3) {
    if (isHindi) {
      const hindiFallbacks = [
        'पर्याप्त मात्रा में पानी पिएं और शरीर को हाइड्रेटेड रखें।',
        'आराम करें और किसी भी भारी शारीरिक गतिविधि से बचें।',
        'यदि लक्षण बढ़ें तो बिना देरी किए किसी प्रमाणित चिकित्सक से परामर्श लें।'
      ];
      for (const fb of hindiFallbacks) {
        if (safeOutput.generalGuidance.length >= 3) break;
        if (!safeOutput.generalGuidance.includes(fb)) safeOutput.generalGuidance.push(fb);
      }
    } else if (isHinglish) {
      const hinglishFallbacks = [
        'Proper hydration banaye rakhein aur paani pijiye.',
        'Aaram karein aur heavy physical exertion avoid karein.',
        'Agar symptoms badhte hain to turant qualified doctor se consult karein.'
      ];
      for (const fb of hinglishFallbacks) {
        if (safeOutput.generalGuidance.length >= 3) break;
        if (!safeOutput.generalGuidance.includes(fb)) safeOutput.generalGuidance.push(fb);
      }
    } else {
      const englishFallbacks = [
        'Ensure adequate hydration with water or electrolyte fluids.',
        'Rest comfortably and avoid strenuous physical exertion while symptoms persist.',
        'Monitor your symptoms closely and seek clinical evaluation if condition does not improve.'
      ];
      for (const fb of englishFallbacks) {
        if (safeOutput.generalGuidance.length >= 3) break;
        if (!safeOutput.generalGuidance.includes(fb)) safeOutput.generalGuidance.push(fb);
      }
    }
  }

  // Deduplicate between primarySolutions and generalGuidance
  safeOutput.generalGuidance = safeOutput.generalGuidance.filter(
    g => !safeOutput.primarySolutions.some(s => s.trim().toLowerCase() === g.trim().toLowerCase())
  );
  if (safeOutput.generalGuidance.length < 2) {
    const defaultDistinct = isHindi
      ? 'यदि लक्षण बने रहें या स्थिति में सुधार न हो तो प्रमाणित डॉक्टर से परामर्श लें।'
      : (isHinglish ? 'Agar symptoms theek na hon to qualified doctor se consult karein.' : 'Consult a qualified doctor if symptoms persist or do not improve.');
    if (!safeOutput.generalGuidance.includes(defaultDistinct)) {
      safeOutput.generalGuidance.push(defaultDistinct);
    }
  }

  return {
    safeOutput,
    isEmergency
  };
};

module.exports = {
  evaluateSafety,
  enforceSafetyGuardrails,
  EMERGENCY_PATTERNS
};
