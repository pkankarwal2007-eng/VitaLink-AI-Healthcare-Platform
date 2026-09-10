const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dosage: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1, min: 1 },
  unitPrice: { type: Number, required: true, default: 50 },
  totalPrice: { type: Number, required: true, default: 50 },
  instructions: { type: String, default: 'After meals' }
});

const deliveryAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pinCode: { type: String, required: true, trim: true }
});

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  location: {
    type: String,
    default: ''
  }
});

const medicineOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      required: true
    },
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
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [arr => arr.length > 0, 'Order must contain at least one medicine item.']
    },
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryFee: {
      type: Number,
      default: 40,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'card', 'upi', 'netbanking'],
      default: 'cod'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING
    },
    statusHistory: [statusHistorySchema],
    shippingPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    shippingProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingProfile'
    },
    assignedAt: {
      type: Date
    },
    acceptedAt: {
      type: Date
    },
    pickedUpAt: {
      type: Date
    },
    outForDeliveryAt: {
      type: Date
    },
    deliveredAt: {
      type: Date
    },
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    estimatedDelivery: {
      type: Date
    },
    notes: {
      type: String,
      default: ''
    },
    offeredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    offerExpiresAt: {
      type: Date
    },
    activeAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingAssignment'
    },
    rejectedPartners: [
      {
        partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectedAt: { type: Date, default: Date.now },
        reason: { type: String, default: '' }
      }
    ],
    dispatchStatus: {
      type: String,
      enum: ['unassigned', 'offered', 'assigned', 'in_transit', 'delivered', 'failed'],
      default: 'unassigned'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

medicineOrderSchema.virtual('assignedShippingPartnerId').get(function () {
  return this.shippingPartner;
});

medicineOrderSchema.virtual('deliveryAddressSnapshot').get(function () {
  return this.deliveryAddress;
});

medicineOrderSchema.index({ patient: 1, createdAt: -1 });
medicineOrderSchema.index({ shippingPartner: 1, status: 1 });
medicineOrderSchema.index({ offeredTo: 1, status: 1 });
medicineOrderSchema.index({ status: 1 });

module.exports = mongoose.model('MedicineOrder', medicineOrderSchema);
