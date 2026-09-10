const mongoose = require('mongoose');
const { APPOINTMENT_TYPES, APPOINTMENT_STATUS } = require('../config/constants');

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    doctorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile'
    },
    date: {
      type: Date,
      required: true
    },
    timeSlot: {
      start: { type: String, required: true },
      end: { type: String, required: true }
    },
    consultationType: {
      type: String,
      enum: Object.values(APPOINTMENT_TYPES),
      default: APPOINTMENT_TYPES.VIDEO
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.PENDING
    },
    fee: {
      type: Number,
      default: 500
    },
    notes: {
      type: String,
      default: ''
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    // Doctor suggested alternative time fields
    suggestedDate: {
      type: Date
    },
    suggestedTimeSlot: {
      start: { type: String },
      end: { type: String }
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    suggestedAt: {
      type: Date
    },
    suggestionReason: {
      type: String,
      default: ''
    },
    // Doctor rejection fields
    rejectionReason: {
      type: String,
      default: ''
    },
    rejectedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Patient decline fields
    declineReason: {
      type: String,
      default: ''
    },
    declinedAt: {
      type: Date
    },
    // Video room identifier for WebRTC session
    videoRoomId: {
      type: String,
      default: ''
    },
    // Consultation session tracking
    consultationStartedAt: {
      type: Date
    },
    consultationEndedAt: {
      type: Date
    },
    consultationDuration: {
      type: Number,
      default: 0
    },
    lastConsultationStatus: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

appointmentSchema.index({ doctor: 1, date: 1, 'timeSlot.start': 1 });
appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
