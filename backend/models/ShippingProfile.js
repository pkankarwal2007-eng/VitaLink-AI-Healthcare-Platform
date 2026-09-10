const mongoose = require('mongoose');

const shippingProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    companyName: {
      type: String,
      trim: true,
      default: ''
    },
    vehicleType: {
      type: String,
      enum: ['bike', 'van', 'scooter', 'truck', 'other'],
      default: 'bike'
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: ''
    },
    serviceCities: {
      type: [String],
      default: ['Mumbai']
    },
    servicePincodes: {
      type: [String],
      default: []
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    activeOrdersCount: {
      type: Number,
      default: 0
    },
    totalDeliveredCount: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    serviceAddress: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    state: {
      type: String,
      trim: true,
      default: ''
    },
    pinCode: {
      type: String,
      trim: true,
      default: ''
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    serviceRadiusKm: {
      type: Number,
      default: 30,
      min: 1
    },
    maxActiveCapacity: {
      type: Number,
      default: 10,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

shippingProfileSchema.index({ serviceCities: 1, isAvailable: 1 });

module.exports = mongoose.model('ShippingProfile', shippingProfileSchema);
