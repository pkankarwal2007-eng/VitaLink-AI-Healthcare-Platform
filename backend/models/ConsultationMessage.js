const mongoose = require('mongoose');

const consultationMessageSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    attachments: [
      {
        fileName: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        fileType: { type: String, trim: true }
      }
    ]
  },
  {
    timestamps: true
  }
);

consultationMessageSchema.index({ appointment: 1, createdAt: 1 });
consultationMessageSchema.index({ receiver: 1, isRead: 1 });

module.exports = mongoose.model('ConsultationMessage', consultationMessageSchema);
