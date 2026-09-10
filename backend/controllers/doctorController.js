const DoctorProfile = require('../models/DoctorProfile');
const DoctorVerification = require('../models/DoctorVerification');
const User = require('../models/User');
const { VERIFICATION_STATUS, ROLES } = require('../config/constants');
const slotService = require('../services/slotService');
const { createNotification } = require('../services/notificationService');
const { escapeRegex } = require('../utils/security');

// @desc    Get Current Doctor's Profile & Verification Status
// @route   GET /api/v1/doctors/profile/me
// @access  Protected (Doctor)
const getMyDoctorProfile = async (req, res, next) => {
  try {
    let profile = await DoctorProfile.findOne({ user: req.user.id });

    // Auto-create initial draft profile if none exists
    if (!profile) {
      profile = await DoctorProfile.create({
        user: req.user.id,
        verificationStatus: VERIFICATION_STATUS.DRAFT,
        isVerified: false
      });
    }

    const verification = await DoctorVerification.findOne({ doctor: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Doctor profile retrieved successfully.',
      data: {
        profile,
        verification: verification || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or Update Doctor Clinical Profile
// @route   PUT /api/v1/doctors/profile
// @access  Protected (Doctor)
const updateDoctorProfile = async (req, res, next) => {
  try {
    const {
      medicalRegistrationNumber,
      highestDegree,
      college,
      graduationYear,
      experienceYears,
      specialization,
      skills,
      hospitalName,
      hospitalAddress,
      consultationFee,
      availableDays,
      availableTime,
      breakTime,
      appointmentDuration,
      consultationModes,
      about,
      languages
    } = req.body;

    const profileFields = {
      medicalRegistrationNumber,
      highestDegree,
      college,
      graduationYear,
      experienceYears,
      specialization,
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : undefined),
      hospitalName,
      hospitalAddress,
      consultationFee,
      availableDays: Array.isArray(availableDays) ? availableDays : (availableDays ? availableDays.split(',').map(s => s.trim()) : undefined),
      availableTime,
      breakTime,
      appointmentDuration,
      consultationModes: Array.isArray(consultationModes) ? consultationModes : (consultationModes ? consultationModes.split(',').map(s => s.trim()) : undefined),
      about,
      languages: Array.isArray(languages) ? languages : (languages ? languages.split(',').map(s => s.trim()) : undefined)
    };

    // Remove undefined
    Object.keys(profileFields).forEach(
      (k) => profileFields[k] === undefined && delete profileFields[k]
    );

    let profile = await DoctorProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: profileFields,
        $setOnInsert: {
          verificationStatus: VERIFICATION_STATUS.DRAFT,
          isVerified: false
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Doctor profile updated successfully.',
      data: {
        profile
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit Doctor Verification Documents
// @route   POST /api/v1/doctors/verification
// @access  Protected (Doctor)
const submitVerification = async (req, res, next) => {
  try {
    const doctorId = req.user.id;

    let profile = await DoctorProfile.findOne({ user: doctorId });
    if (!profile) {
      profile = await DoctorProfile.create({
        user: doctorId,
        verificationStatus: VERIFICATION_STATUS.PENDING
      });
    }

    const files = req.files || {};
    const documents = [];

    if (files.degreeCertificate && files.degreeCertificate[0]) {
      documents.push({
        docType: 'degree_certificate',
        fileName: files.degreeCertificate[0].filename,
        fileUrl: `/api/v1/admin/verification-documents/${files.degreeCertificate[0].filename}`
      });
    }

    if (files.medicalLicense && files.medicalLicense[0]) {
      documents.push({
        docType: 'medical_license',
        fileName: files.medicalLicense[0].filename,
        fileUrl: `/api/v1/admin/verification-documents/${files.medicalLicense[0].filename}`
      });
    }

    if (files.aadhaarCard && files.aadhaarCard[0]) {
      documents.push({
        docType: 'aadhaar_card',
        fileName: files.aadhaarCard[0].filename,
        fileUrl: `/api/v1/admin/verification-documents/${files.aadhaarCard[0].filename}`
      });
    }

    if (files.other && files.other[0]) {
      documents.push({
        docType: 'other',
        fileName: files.other[0].filename,
        fileUrl: `/api/v1/admin/verification-documents/${files.other[0].filename}`
      });
    }

    let verification = await DoctorVerification.findOne({ doctor: doctorId });

    if (verification) {
      // Append newly uploaded documents
      verification.documents.push(...documents);
      verification.status = VERIFICATION_STATUS.PENDING;
      verification.submittedAt = new Date();
      verification.statusHistory.push({
        status: VERIFICATION_STATUS.PENDING,
        changedBy: doctorId,
        reason: 'Verification submitted by doctor'
      });
      await verification.save();
    } else {
      verification = await DoctorVerification.create({
        doctor: doctorId,
        doctorProfile: profile._id,
        status: VERIFICATION_STATUS.PENDING,
        documents,
        submittedAt: new Date(),
        statusHistory: [
          {
            status: VERIFICATION_STATUS.PENDING,
            changedBy: doctorId,
            reason: 'Initial verification submission'
          }
        ]
      });
    }

    // Update profile verification status
    profile.verificationStatus = VERIFICATION_STATUS.PENDING;
    await profile.save();

    // Notify administrators
    try {
      const adminUsers = await User.find({ role: ROLES.ADMIN, isActive: true });
      for (const admin of adminUsers) {
        await createNotification({
          recipient: admin._id,
          sender: req.user._id,
          type: 'verification_request',
          title: 'Doctor Verification Submitted',
          message: `Dr. ${req.user.fullName} submitted credentials for verification review.`,
          link: '/admin/verifications',
          data: { doctorId: req.user._id, verificationId: verification._id }
        });
      }
    } catch (err) {
      console.error('[Verification Notification Error]:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Verification documents submitted successfully. Your credentials are now in the review queue.',
      data: {
        status: VERIFICATION_STATUS.PENDING,
        documentsCount: verification.documents.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Public Verified Doctors (STRICTLY Approved Only)
// @route   GET /api/v1/doctors
// @access  Public
const getPublicDoctors = async (req, res, next) => {
  try {
    const {
      search,
      specialization,
      city,
      hospital,
      minExperience,
      maxExperience,
      minFee,
      maxFee,
      minRating,
      consultationType,
      day,
      sortBy = 'rating',
      page = 1,
      limit = 10
    } = req.query;

    // MANDATORY FILTER: Strictly approved & verified doctors only
    const andClauses = [
      { verificationStatus: VERIFICATION_STATUS.APPROVED },
      { isVerified: true }
    ];

    if (specialization && specialization !== 'All Specialties') {
      andClauses.push({ specialization });
    }

    if (hospital && hospital.trim()) {
      andClauses.push({ hospitalName: { $regex: escapeRegex(hospital.trim()), $options: 'i' } });
    }

    if (minExperience !== undefined && minExperience !== '') {
      andClauses.push({ experienceYears: { $gte: parseInt(minExperience, 10) || 0 } });
    }

    if (maxExperience !== undefined && maxExperience !== '') {
      andClauses.push({ experienceYears: { $lte: parseInt(maxExperience, 10) } });
    }

    if (minFee !== undefined && minFee !== '') {
      andClauses.push({ consultationFee: { $gte: parseInt(minFee, 10) || 0 } });
    }

    if (maxFee !== undefined && maxFee !== '') {
      andClauses.push({ consultationFee: { $lte: parseInt(maxFee, 10) } });
    }

    if (minRating !== undefined && minRating !== '') {
      andClauses.push({ rating: { $gte: parseFloat(minRating) || 0 } });
    }

    if (consultationType) {
      andClauses.push({ consultationModes: consultationType });
    }

    if (day) {
      andClauses.push({ availableDays: day });
    }

    // Handle city search across hospitalAddress and User.city
    let userCityFilterIds = null;
    if (city && city.trim()) {
      const escapedCity = escapeRegex(city.trim());
      const cityUsers = await User.find({
        role: ROLES.DOCTOR,
        city: { $regex: escapedCity, $options: 'i' }
      }).select('_id');
      userCityFilterIds = cityUsers.map((u) => u._id);
    }

    // Handle text search across doctor name, hospital, and specialization
    let searchUserIds = null;
    let escapedSearch = '';
    if (search && search.trim()) {
      escapedSearch = escapeRegex(search.trim());
      const matchingUsers = await User.find({
        role: ROLES.DOCTOR,
        isActive: true,
        fullName: { $regex: escapedSearch, $options: 'i' }
      }).select('_id');
      searchUserIds = matchingUsers.map((u) => u._id);
    }

    // Combine user ID / address queries
    const orClauses = [];

    if (searchUserIds !== null) {
      orClauses.push(
        { user: { $in: searchUserIds } },
        { hospitalName: { $regex: escapedSearch, $options: 'i' } },
        { specialization: { $regex: escapedSearch, $options: 'i' } }
      );
    }

    if (userCityFilterIds !== null) {
      if (orClauses.length > 0) {
        andClauses.push({ $or: orClauses });
        andClauses.push({
          $or: [
            { user: { $in: userCityFilterIds } },
            { hospitalAddress: { $regex: city.trim(), $options: 'i' } }
          ]
        });
      } else {
        andClauses.push({
          $or: [
            { user: { $in: userCityFilterIds } },
            { hospitalAddress: { $regex: city.trim(), $options: 'i' } }
          ]
        });
      }
    } else if (orClauses.length > 0) {
      andClauses.push({ $or: orClauses });
    }

    const query = { $and: andClauses };

    const sortOptions = {};
    if (sortBy === 'fee_asc') sortOptions.consultationFee = 1;
    else if (sortBy === 'fee_desc') sortOptions.consultationFee = -1;
    else if (sortBy === 'experience') sortOptions.experienceYears = -1;
    else if (sortBy === 'name') sortOptions['user.fullName'] = 1;
    else if (sortBy === 'rating') sortOptions.rating = req.query.sortOrder === 'asc' ? 1 : -1;
    else sortOptions.rating = -1; // Default highest rated

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await DoctorProfile.countDocuments(query);
    const doctors = await DoctorProfile.find(query)
      .populate('user', 'fullName avatar email phone city state isActive')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    // Double check that active user status is respected
    const safeDoctors = doctors.filter((d) => d.user && d.user.isActive);

    res.status(200).json({
      success: true,
      message: 'Verified doctors retrieved successfully.',
      data: {
        doctors: safeDoctors,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Public Verified Doctor Details by ID
// @route   GET /api/v1/doctors/:id
// @access  Public
const getPublicDoctorById = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Support both DoctorProfile ID and User ID
    let doctor = await DoctorProfile.findOne({
      _id: id,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isVerified: true
    }).populate('user', 'fullName avatar city state phone email');

    if (!doctor) {
      doctor = await DoctorProfile.findOne({
        user: id,
        verificationStatus: VERIFICATION_STATUS.APPROVED,
        isVerified: true
      }).populate('user', 'fullName avatar city state phone email');
    }

    if (!doctor || !doctor.user) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or not currently verified on VitaLink.',
        code: 'DOCTOR_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Doctor profile retrieved successfully.',
      data: {
        doctor
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Doctor Available Appointment Slots for a Specific Date
// @route   GET /api/v1/doctors/:id/slots
// @access  Public
const getDoctorAvailableSlots = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Query parameter date (YYYY-MM-DD) is required.'
      });
    }

    // Find verified doctor profile
    let doctorProfile = await DoctorProfile.findOne({
      _id: id,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isVerified: true
    });

    if (!doctorProfile) {
      doctorProfile = await DoctorProfile.findOne({
        user: id,
        verificationStatus: VERIFICATION_STATUS.APPROVED,
        isVerified: true
      });
    }

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        code: 'DOCTOR_NOT_FOUND',
        message: 'Verified doctor profile not found.'
      });
    }

    const slotData = await slotService.generateDoctorSlots({
      doctorProfile,
      dateStr: date
    });

    res.status(200).json({
      success: true,
      message: 'Available appointment slots retrieved successfully.',
      data: slotData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyDoctorProfile,
  updateDoctorProfile,
  submitVerification,
  getPublicDoctors,
  getPublicDoctorById,
  getDoctorAvailableSlots
};
