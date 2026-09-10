const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    recordType: {
      type: String,
      enum: ['consultation', 'prescription', 'test_report', 'clinical_note', 'general'],
      default: 'consultation'
    },
    title: {
      type: String,
      required: true
    },
    summary: {
      type: String,
      required: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    documentUrl: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

medicalRecordSchema.index({ patient: 1, date: -1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
