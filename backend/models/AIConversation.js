const mongoose = require('mongoose');

const aiConversationSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'New Health Assessment',
      trim: true,
      maxlength: 120
    },
    suggestedSpecialty: {
      type: String,
      default: ''
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

aiConversationSchema.index({ patient: 1, lastMessageAt: -1 });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
