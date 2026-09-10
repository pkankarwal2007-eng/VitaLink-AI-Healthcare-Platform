const mongoose = require('mongoose');
const { VERIFICATION_STATUS, SPECIALIZATIONS } = require('../config/constants');

const doctorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    medicalRegistrationNumber: {
      type: String,
      trim: true,
      default: ''
    },
    highestDegree: {
      type: String,
      trim: true,
      default: ''
    },
    college: {
      type: String,
      trim: true,
      default: ''
    },
    graduationYear: {
      type: Number
    },
    experienceYears: {
      type: Number,
      default: 0
    },
    specialization: {
      type: String,
      enum: SPECIALIZATIONS,
      default: 'General Physician'
    },
    skills: {
      type: [String],
      default: []
    },
    hospitalName: {
      type: String,
      trim: true,
      default: ''
    },
    hospitalAddress: {
      type: String,
      trim: true,
      default: ''
    },
    consultationFee: {
      type: Number,
      default: 500
    },
    availableDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    availableTime: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' }
    },
    breakTime: {
      start: { type: String, default: '13:00' },
      end: { type: String, default: '14:00' }
    },
    appointmentDuration: {
      type: Number, // in minutes
      default: 30
    },
    consultationModes: {
      type: [String],
      default: ['chat', 'video', 'physical']
    },
    about: {
      type: String,
      default: ''
    },
    languages: {
      type: [String],
      default: ['English', 'Hindi']
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

doctorProfileSchema.index({ specialization: 1, isVerified: 1 });
doctorProfileSchema.index({ hospitalName: 1 });
doctorProfileSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);
