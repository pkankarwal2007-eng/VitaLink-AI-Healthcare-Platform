const mongoose = require('mongoose');

const testReportSchema = new mongoose.Schema(
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
    testName: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['CBC', 'Blood Glucose', 'Lipid Profile', 'ECG', 'X-Ray', 'MRI', 'CT', 'Urine Test', 'Other'],
      default: 'Other'
    },
    status: {
      type: String,
      enum: ['recommended', 'uploaded', 'reviewed'],
      default: 'recommended'
    },
    reportFileUrl: {
      type: String,
      default: ''
    },
    reportFileName: {
      type: String,
      default: ''
    },
    findings: {
      type: String,
      default: ''
    },
    reviewedNotes: {
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

testReportSchema.index({ patient: 1, date: -1 });

module.exports = mongoose.model('TestReport', testReportSchema);
