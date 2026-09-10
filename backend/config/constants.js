module.exports = {
  ROLES: {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    SHIPPING: 'shipping',
    ADMIN: 'admin'
  },
  VERIFICATION_STATUS: {
    DRAFT: 'draft',
    PENDING: 'pending',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CHANGES_REQUESTED: 'changes_requested',
    SUSPENDED: 'suspended'
  },
  APPOINTMENT_TYPES: {
    CHAT: 'chat',
    VIDEO: 'video',
    PHYSICAL: 'physical'
  },
  APPOINTMENT_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    SUGGESTED_TIME: 'suggested_time',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    DECLINED: 'declined',
    COMPLETED: 'completed',
    NO_SHOW: 'no-show'
  },
  ORDER_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PACKED: 'packed',
    ASSIGNED: 'assigned',
    PICKED_UP: 'picked_up',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  },
  SPECIALIZATIONS: [
    'General Physician',
    'Cardiologist',
    'Dermatologist',
    'Neurologist',
    'Orthopedic',
    'Pediatrician',
    'Gynecologist',
    'ENT Specialist',
    'Psychiatrist',
    'Ophthalmologist',
    'Dentist',
    'Radiologist',
    'Surgeon',
    'Urologist',
    'Other'
  ]
};
