const mongoose = require('mongoose');

const shippingAssignmentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicineOrder',
      required: true,
      index: true
    },
    shippingPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    shippingProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingProfile'
    },
    status: {
      type: String,
      enum: ['offered', 'accepted', 'rejected', 'expired', 'cancelled', 'completed'],
      default: 'offered',
      index: true
    },
    distanceKm: {
      type: Number,
      default: null
    },
    matchType: {
      type: String,
      enum: ['coordinates', 'pincode', 'city', 'state', 'fallback'],
      default: 'city'
    },
    offeredAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000) // 15-minute default offer window
    },
    acceptedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases for compatibility
shippingAssignmentSchema.virtual('orderId').get(function () {
  return this.order;
});

shippingAssignmentSchema.virtual('shippingPartnerId').get(function () {
  return this.shippingPartner;
});

shippingAssignmentSchema.virtual('assignmentStatus').get(function () {
  return this.status;
});

shippingAssignmentSchema.index({ order: 1, shippingPartner: 1 });
shippingAssignmentSchema.index({ shippingPartner: 1, status: 1 });

module.exports = mongoose.model('ShippingAssignment', shippingAssignmentSchema);
