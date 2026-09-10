const mongoose = require('mongoose');
const { VERIFICATION_STATUS } = require('../config/constants');

const documentItemSchema = new mongoose.Schema({
  docType: {
    type: String,
    required: true,
    enum: ['degree_certificate', 'medical_license', 'aadhaar_card', 'other']
  },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const doctorVerificationSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    doctorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: true
    },
    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING
    },
    documents: [documentItemSchema],
    submittedAt: {
      type: Date,
      default: Date.now
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    adminNotes: {
      type: String,
      default: ''
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        changedAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

doctorVerificationSchema.index({ status: 1 });

module.exports = mongoose.model('DoctorVerification', doctorVerificationSchema);
