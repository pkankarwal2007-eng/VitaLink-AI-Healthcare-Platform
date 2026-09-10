const mongoose = require('mongoose');

const structuredDataSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      default: ''
    },
    possibleConcerns: {
      type: [String],
      default: []
    },
    primarySolutions: {
      type: [String],
      default: []
    },
    generalGuidance: {
      type: [String],
      default: []
    },
    warningSigns: {
      type: [String],
      default: []
    },
    recommendedSpecialty: {
      type: String,
      default: 'General Physician'
    },
    needsDoctor: {
      type: Boolean,
      default: true
    },
    urgent: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const aiMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sender: {
      type: String,
      enum: ['patient', 'assistant', 'system'],
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    structuredData: {
      type: structuredDataSchema,
      default: null
    },
    isEmergency: {
      type: Boolean,
      default: false
    },
    disclaimer: {
      type: String,
      default: 'VitaLink AI provides general health information and does not replace a qualified healthcare professional.'
    }
  },
  {
    timestamps: true
  }
);

aiMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('AIMessage', aiMessageSchema);
