const { SPECIALIZATIONS } = require('../config/constants');

/**
 * Normalizes any LLM-suggested specialty string to a valid VitaLink specialization.
 * @param {string} rawSpecialty - Raw text output from LLM (e.g., "Cardiology", "Dermatologist")
 * @returns {string} One of the official VitaLink SPECIALIZATIONS
 */
const normalizeSpecialty = (rawSpecialty) => {
  if (!rawSpecialty || typeof rawSpecialty !== 'string') {
    return 'General Physician';
  }

  const cleaned = rawSpecialty.trim().toLowerCase();

  // Direct match against known list
  const directMatch = SPECIALIZATIONS.find(
    spec => spec.toLowerCase() === cleaned
  );
  if (directMatch) return directMatch;

  // Semantic mapping dictionary
  const mappings = [
    {
      target: 'Cardiologist',
      keywords: ['cardio', 'heart', 'coronary', 'hypertension', 'arrhythmia', 'angina']
    },
    {
      target: 'Dermatologist',
      keywords: ['derma', 'skin', 'rash', 'eczema', 'psoriasis', 'acne', 'mole']
    },
    {
      target: 'Neurologist',
      keywords: ['neuro', 'brain', 'nerve', 'migraine', 'epilepsy', 'seizure', 'neuropathy', 'parkinson']
    },
    {
      target: 'Orthopedic',
      keywords: ['ortho', 'bone', 'joint', 'fracture', 'arthritis', 'spine', 'back pain', 'knee', 'ligament']
    },
    {
      target: 'Pediatrician',
      keywords: ['pediatric', 'paediatric', 'child', 'infant', 'newborn', 'baby', 'toddler']
    },
    {
      target: 'Gynecologist',
      keywords: ['gynec', 'gynaec', 'ob-gyn', 'obstetric', 'maternity', 'pregnancy', 'menstrual', 'pelvic', 'uterine']
    },
    {
      target: 'ENT Specialist',
      keywords: ['ent', 'ear', 'nose', 'throat', 'sinus', 'tonsil', 'larynx', 'tinnitus', 'hearing']
    },
    {
      target: 'Psychiatrist',
      keywords: ['psychiatr', 'psycholog', 'mental health', 'depression', 'anxiety', 'panic', 'bipolar', 'mood']
    },
    {
      target: 'Ophthalmologist',
      keywords: ['ophthalm', 'eye', 'vision', 'glaucoma', 'cataract', 'retina', 'cornea']
    },
    {
      target: 'Dentist',
      keywords: ['dent', 'tooth', 'teeth', 'gum', 'oral', 'cavity']
    },
    {
      target: 'Urologist',
      keywords: ['urolo', 'urinary', 'bladder', 'kidney', 'prostate', 'nephro']
    },
    {
      target: 'Surgeon',
      keywords: ['surgeon', 'surgery', 'surgical', 'operative']
    },
    {
      target: 'Radiologist',
      keywords: ['radiolog', 'imaging', 'mri', 'ct scan', 'x-ray', 'ultrasound']
    },
    {
      target: 'General Physician',
      keywords: [
        'general',
        'physician',
        'practitioner',
        'internal medicine',
        'primary care',
        'family medicine',
        'fever',
        'cold',
        'flu',
        'emergency',
        'casualty',
        'snake',
        'venom',
        'poison',
        'toxicology',
        'envenomation',
        'urgent care',
        'triage',
        'weakness',
        'fatigue'
      ]
    }
  ];

  for (const { target, keywords } of mappings) {
    if (keywords.some(k => cleaned.includes(k))) {
      return target;
    }
  }

  return 'General Physician';
};

/**
 * Returns all officially supported medical specializations.
 */
const getSupportedSpecializations = () => {
  return [...SPECIALIZATIONS];
};

module.exports = {
  normalizeSpecialty,
  getSupportedSpecializations
};
