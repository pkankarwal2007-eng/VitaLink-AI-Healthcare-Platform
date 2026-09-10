const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const { generateToken } = require('../utils/jwt');
const { ROLES, VERIFICATION_STATUS } = require('../config/constants');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/otp');
const { sendEmailVerificationOtp } = require('../services/emailService');

// @desc    Register a new user (Patient, Doctor, Shipping Partner ONLY)
// @route   POST /api/v1/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      gender,
      dateOfBirth,
      address,
      city,
      state,
      pinCode,
      password,
      confirmPassword,
      role
    } = req.body;

    // Reject admin registration from public endpoints
    if (role === ROLES.ADMIN || role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin accounts cannot be registered through public registration.',
        code: 'ADMIN_REGISTRATION_FORBIDDEN',
        errors: [{ field: 'role', message: 'Unauthorized role assignment' }]
      });
    }

    // Supported public roles
    const allowedRoles = [ROLES.PATIENT, ROLES.DOCTOR, ROLES.SHIPPING];
    const userRole = role ? role.toLowerCase() : ROLES.PATIENT;

    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Supported roles are: ${allowedRoles.join(', ')}`,
        code: 'INVALID_ROLE',
        errors: [{ field: 'role', message: 'Unsupported role' }]
      });
    }

    // Password validation
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
        code: 'INVALID_PASSWORD',
        errors: [{ field: 'password', message: 'Minimum 6 characters required' }]
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
        code: 'PASSWORDS_DO_NOT_MATCH',
        errors: [{ field: 'confirmPassword', message: 'Passwords must match' }]
      });
    }

    // Normalize email
    const normalizedEmail = (email && typeof email === 'string') ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
        code: 'EMAIL_REQUIRED',
        errors: [{ field: 'email', message: 'Valid email required' }]
      });
    }

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
        code: 'EMAIL_EXISTS',
        errors: [{ field: 'email', message: 'Email is already registered' }]
      });
    }

    // Generate 6-digit verification OTP and cryptographic HMAC hash
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresMinutes = parseInt(process.env.EMAIL_VERIFICATION_OTP_EXPIRES_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

    // Create user
    const user = await User.create({
      fullName: fullName ? fullName.trim() : '',
      email: normalizedEmail,
      phone: phone ? phone.trim() : '',
      gender: gender || 'other',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      state: state ? state.trim() : '',
      pinCode: pinCode ? pinCode.trim() : '',
      password,
      role: userRole,
      isActive: true,
      isEmailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationOtpExpiresAt: expiresAt,
      emailVerificationOtpAttempts: 0,
      emailVerificationLastSentAt: new Date()
    });

    // Initialize unverified DoctorProfile for newly registered doctors
    if (userRole === ROLES.DOCTOR) {
      await DoctorProfile.create({
        user: user._id,
        verificationStatus: VERIFICATION_STATUS.DRAFT,
        isVerified: false
      });
    }

    // Send branded verification email with inline CID logo
    const emailResult = await sendEmailVerificationOtp({
      email: normalizedEmail,
      fullName: user.fullName,
      otp,
      expiresMinutes
    });

    if (!emailResult.delivered) {
      // Clean up newly created unverified user to prevent locking the email in an unverified state
      await User.findByIdAndDelete(user._id);
      if (userRole === ROLES.DOCTOR) {
        await DoctorProfile.findOneAndDelete({ user: user._id });
      }

      const failureReason = emailResult.error || 'Failed to dispatch verification email via SMTP.';
      return res.status(503).json({
        success: false,
        message: `Unable to send verification email (${failureReason}). Please ensure EMAIL_PASSWORD is configured in the root .env file.`,
        code: 'EMAIL_DELIVERY_FAILED',
        errors: [{ field: 'email', message: failureReason }]
      });
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful. A 6-digit verification code has been sent to your email address.',
      data: {
        user: user.toSafeObject(),
        token,
        isEmailVerified: false,
        email: normalizedEmail
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    User Login (Patient, Doctor, Shipping)
// @route   POST /api/v1/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
        code: 'CREDENTIALS_REQUIRED',
        errors: []
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
        errors: []
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact VitaLink support.',
        code: 'ACCOUNT_DEACTIVATED',
        errors: []
      });
    }

    let isMatch = await user.matchPassword(password);
    if (!isMatch && typeof password === 'string') {
      const trimmedPassword = password.trim();
      if (trimmedPassword !== password) {
        isMatch = await user.matchPassword(trimmedPassword);
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
        errors: []
      });
    }

    // Verify email status before permitting normal login (admin accounts exempt)
    if (user.role !== ROLES.ADMIN && user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Your email address is not verified. Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        data: {
          email: user.email,
          isEmailVerified: false
        }
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: user.toSafeObject(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Dedicated Login
// @route   POST /api/v1/auth/admin-login
// @access  Restricted to database verified admin role
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide admin email and password.',
        code: 'CREDENTIALS_REQUIRED'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or administrative privileges.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Enforce role === 'admin' strictly in database
    if (user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Account is not registered as an administrator.',
        code: 'ADMIN_ROLE_REQUIRED'
      });
    }

    let isMatch = await user.matchPassword(password);
    if (!isMatch && typeof password === 'string') {
      const trimmedPassword = password.trim();
      if (trimmedPassword !== password) {
        isMatch = await user.matchPassword(trimmedPassword);
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or administrative privileges.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Administrator authenticated successfully.',
      data: {
        user: user.toSafeObject(),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Current User Profile
// @route   GET /api/v1/auth/me
// @access  Protected
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User profile fetched successfully.',
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Profile
// @route   PUT /api/v1/auth/profile
// @access  Protected
const updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      fullName: req.body.fullName,
      phone: req.body.phone,
      gender: req.body.gender,
      dateOfBirth: req.body.dateOfBirth,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      pinCode: req.body.pinCode
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      (key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify user email using 6-digit OTP
// @route   POST /api/v1/auth/verify-email
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Both email address and 6-digit verification code are required.',
        code: 'VERIFICATION_FIELDS_REQUIRED'
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be a 6-digit number.',
        code: 'INVALID_OTP_FORMAT'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationLastSentAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Your email is already verified. You can proceed to log in.',
        code: 'ALREADY_VERIFIED',
        data: {
          isEmailVerified: true
        }
      });
    }

    const maxAttempts = 5;
    if ((user.emailVerificationOtpAttempts || 0) >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new verification code.',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      });
    }

    if (!user.emailVerificationOtpHash || !user.emailVerificationOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'No active verification code found. Please request a new code.',
        code: 'NO_ACTIVE_OTP'
      });
    }

    if (new Date() > user.emailVerificationOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
        code: 'OTP_EXPIRED'
      });
    }

    const isValid = verifyOtp(cleanOtp, user.emailVerificationOtpHash);
    if (!isValid) {
      user.emailVerificationOtpAttempts = (user.emailVerificationOtpAttempts || 0) + 1;
      await user.save();

      const remaining = Math.max(0, maxAttempts - user.emailVerificationOtpAttempts);
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : 'Invalid verification code. Maximum attempts reached. Please request a new code.',
        code: 'INVALID_OTP',
        attemptsRemaining: remaining
      });
    }

    // Successful verification: mark verified and clear OTP credentials
    user.isEmailVerified = true;
    user.emailVerificationOtpHash = undefined;
    user.emailVerificationOtpExpiresAt = undefined;
    user.emailVerificationOtpAttempts = 0;
    user.emailVerificationLastSentAt = undefined;
    await user.save();

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in to your VitaLink account.',
      code: 'EMAIL_VERIFIED',
      data: {
        user: user.toSafeObject(),
        token,
        isEmailVerified: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend 6-digit verification code with rate limiting cooldown
// @route   POST /api/v1/auth/resend-verification
// @access  Public
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
        code: 'EMAIL_REQUIRED'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+emailVerificationOtpHash +emailVerificationOtpExpiresAt +emailVerificationOtpAttempts +emailVerificationLastSentAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already verified.',
        code: 'ALREADY_VERIFIED'
      });
    }

    const cooldownSeconds = parseInt(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS, 10) || 60;
    if (user.emailVerificationLastSentAt) {
      const elapsedSeconds = (Date.now() - new Date(user.emailVerificationLastSentAt).getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        const waitTime = Math.ceil(cooldownSeconds - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting a new code.`,
          code: 'RESEND_COOLDOWN_ACTIVE',
          secondsRemaining: waitTime
        });
      }
    }

    const expiresMinutes = parseInt(process.env.EMAIL_VERIFICATION_OTP_EXPIRES_MINUTES, 10) || 10;
    const newOtp = generateOtp();
    const newHash = hashOtp(newOtp);

    user.emailVerificationOtpHash = newHash;
    user.emailVerificationOtpExpiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
    user.emailVerificationOtpAttempts = 0;
    user.emailVerificationLastSentAt = new Date();
    await user.save();

    const emailResult = await sendEmailVerificationOtp({
      email: normalizedEmail,
      fullName: user.fullName,
      otp: newOtp,
      expiresMinutes
    });

    if (!emailResult.delivered) {
      const failureReason = emailResult.error || 'Failed to dispatch verification email via SMTP.';
      return res.status(503).json({
        success: false,
        message: `Unable to send verification email (${failureReason}). Please ensure EMAIL_PASSWORD is configured in the root .env file.`,
        code: 'EMAIL_DELIVERY_FAILED'
      });
    }

    res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email address.',
      code: 'OTP_RESENT',
      data: {
        email: normalizedEmail,
        cooldownSeconds
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  adminLogin,
  getMe,
  updateProfile,
  verifyEmail,
  resendVerification
};
