const mongoose = require('mongoose');

const medicationItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dosage: { type: String, required: true }, // e.g. 500mg
  frequency: { type: String, required: true }, // e.g. 1-0-1 or Twice daily
  duration: { type: String, required: true }, // e.g. 5 days
  instructions: { type: String, default: 'After meals' },
  price: { type: Number, default: 50 } // Indicative unit price in INR
});

const prescriptionSchema = new mongoose.Schema(
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
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    clinicalAssessment: {
      type: String,
      required: true
    },
    medications: [medicationItemSchema],
    testsRecommended: {
      type: [String],
      default: []
    },
    advice: {
      type: String,
      default: ''
    },
    followUpDate: {
      type: Date
    },
    orderedForDelivery: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

prescriptionSchema.virtual('patientId').get(function () {
  return this.patient;
});

prescriptionSchema.virtual('doctorId').get(function () {
  return this.doctor;
});

prescriptionSchema.virtual('appointmentId').get(function () {
  return this.appointment;
});

prescriptionSchema.virtual('prescriptionDate').get(function () {
  return this.createdAt;
});

prescriptionSchema.index({ patient: 1, createdAt: -1 });
prescriptionSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
