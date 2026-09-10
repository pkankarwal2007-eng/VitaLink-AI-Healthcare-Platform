const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true // Strictly one review per completed appointment
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1 star.'],
      max: [5, 'Rating cannot exceed 5 stars.']
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Review comment cannot exceed 1000 characters.']
    }
  },
  {
    timestamps: true
  }
);

reviewSchema.index({ doctor: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
