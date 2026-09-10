const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please provide full name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Please provide phone number'],
      trim: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'other'
    },
    dateOfBirth: {
      type: Date
    },
    address: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    pinCode: {
      type: String,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: [ROLES.PATIENT, ROLES.DOCTOR, ROLES.SHIPPING, ROLES.ADMIN],
      default: ROLES.PATIENT
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationOtpHash: {
      type: String,
      select: false
    },
    emailVerificationOtpExpiresAt: {
      type: Date,
      select: false
    },
    emailVerificationOtpAttempts: {
      type: Number,
      default: 0,
      select: false
    },
    emailVerificationLastSentAt: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes: email index is automatically created by unique: true on the field
userSchema.index({ role: 1 });

// Encrypt password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Safe JSON transformation
userSchema.methods.toSafeObject = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  delete user.emailVerificationOtpHash;
  delete user.emailVerificationOtpExpiresAt;
  delete user.emailVerificationOtpAttempts;
  delete user.emailVerificationLastSentAt;
  return user;
};

module.exports = mongoose.model('User', userSchema);
