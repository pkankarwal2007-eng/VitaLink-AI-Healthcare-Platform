const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const DoctorProfile = require('../models/DoctorProfile');
const DoctorVerification = require('../models/DoctorVerification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const TestReport = require('../models/TestReport');
const MedicineOrder = require('../models/MedicineOrder');
const ShippingProfile = require('../models/ShippingProfile');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const ContactMessage = require('../models/ContactMessage');
const { VERIFICATION_STATUS, ROLES, APPOINTMENT_STATUS, ORDER_STATUS } = require('../config/constants');
const { createNotification } = require('../services/notificationService');
const { escapeRegex } = require('../utils/security');

// Helper to record audit log entries
const recordAudit = async (action, req, targetId, details = {}) => {
  try {
    await AuditLog.create({
      action,
      performedBy: req.user.id,
      targetId,
      targetModel: 'User',
      details,
      ipAddress: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || ''
    });
  } catch (err) {
    console.error('[Audit Log Error]:', err.message);
  }
};

// ==========================================
// 1. DOCTOR VERIFICATION QUEUE & ACTIONS
// ==========================================

// @desc    Get List of Pending / Under-Review Doctor Verifications
// @route   GET /api/v1/admin/doctors/pending
// @access  Protected (Admin only)
const getPendingDoctorVerifications = async (req, res, next) => {
  try {
    const status = req.query.status || {
      $in: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.UNDER_REVIEW, VERIFICATION_STATUS.CHANGES_REQUESTED]
    };

    const verifications = await DoctorVerification.find({ status })
      .populate('doctor', 'fullName email phone city state createdAt')
      .populate('doctorProfile')
      .sort({ submittedAt: -1 });

    // Include doctor profiles in pending or under_review status that may not have uploaded documents yet
    const existingDoctorIds = verifications.map(v => v.doctor?._id?.toString()).filter(Boolean);
    const pendingProfiles = await DoctorProfile.find({
      verificationStatus: { $in: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.UNDER_REVIEW] },
      user: { $nin: existingDoctorIds }
    }).populate('user', 'fullName email phone city state createdAt');

    const additionalItems = pendingProfiles.map(p => ({
      _id: `pending_${p._id}`,
      doctor: p.user,
      doctorProfile: p,
      status: p.verificationStatus,
      documents: [],
      submittedAt: p.createdAt || new Date(),
      statusHistory: []
    }));

    const allVerifications = [...verifications, ...additionalItems];

    res.status(200).json({
      success: true,
      message: 'Pending doctor verifications retrieved successfully.',
      data: {
        count: allVerifications.length,
        verifications: allVerifications
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Specific Doctor Verification Details
// @route   GET /api/v1/admin/doctors/:id/verification
// @access  Protected (Admin only)
const getDoctorVerificationDetails = async (req, res, next) => {
  try {
    const doctorId = req.params.id;

    const verification = await DoctorVerification.findOne({ doctor: doctorId })
      .populate('doctor', 'fullName email phone address city state pinCode')
      .populate('doctorProfile')
      .populate('reviewedBy', 'fullName email');

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'No verification submission found for this doctor.',
        code: 'VERIFICATION_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Doctor verification details retrieved successfully.',
      data: {
        verification
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve Doctor Verification
// @route   PATCH /api/v1/admin/doctors/:id/approve
// @access  Protected (Admin only)
const approveDoctorVerification = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { adminNotes } = req.body;

    const profile = await DoctorProfile.findOne({ user: doctorId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor clinical profile not found.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    profile.verificationStatus = VERIFICATION_STATUS.APPROVED;
    profile.isVerified = true;
    await profile.save();

    let verification = await DoctorVerification.findOne({ doctor: doctorId });
    if (verification) {
      verification.status = VERIFICATION_STATUS.APPROVED;
      verification.reviewedBy = req.user.id;
      verification.reviewedAt = new Date();
      if (adminNotes) verification.adminNotes = adminNotes;
      verification.statusHistory.push({
        status: VERIFICATION_STATUS.APPROVED,
        changedBy: req.user.id,
        reason: adminNotes || 'Approved by administrator'
      });
      await verification.save();
    }

    await recordAudit('DOCTOR_VERIFICATION_APPROVED', req, doctorId, {
      adminNotes: adminNotes || 'Approved by administrator'
    });

    await createNotification({
      recipient: doctorId,
      sender: req.user.id,
      type: 'system',
      title: 'Verification Approved',
      message: 'Congratulations! Your medical profile has been verified and approved by VitaLink administration.',
      link: '/doctor/profile',
      data: { doctorId, status: VERIFICATION_STATUS.APPROVED }
    });

    res.status(200).json({
      success: true,
      message: 'Doctor verified and approved successfully. Profile is now publicly visible.',
      data: {
        doctor: profile
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject Doctor Verification
// @route   PATCH /api/v1/admin/doctors/:id/reject
// @access  Protected (Admin only)
const rejectDoctorVerification = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { reason, adminNotes } = req.body;

    if (!reason && !adminNotes) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason or note is required for compliance records.',
        code: 'REJECTION_REASON_REQUIRED'
      });
    }

    const rejectionNote = reason || adminNotes;

    const profile = await DoctorProfile.findOne({ user: doctorId });
    if (profile) {
      profile.verificationStatus = VERIFICATION_STATUS.REJECTED;
      profile.isVerified = false;
      await profile.save();
    }

    let verification = await DoctorVerification.findOne({ doctor: doctorId });
    if (verification) {
      verification.status = VERIFICATION_STATUS.REJECTED;
      verification.reviewedBy = req.user.id;
      verification.reviewedAt = new Date();
      verification.adminNotes = rejectionNote;
      verification.statusHistory.push({
        status: VERIFICATION_STATUS.REJECTED,
        changedBy: req.user.id,
        reason: rejectionNote
      });
      await verification.save();
    }

    await recordAudit('DOCTOR_VERIFICATION_REJECTED', req, doctorId, {
      rejectionReason: rejectionNote
    });

    await createNotification({
      recipient: doctorId,
      sender: req.user.id,
      type: 'system',
      title: 'Verification Rejected',
      message: `Your medical verification was not approved: ${rejectionNote}`,
      link: '/doctor/profile',
      data: { doctorId, status: VERIFICATION_STATUS.REJECTED }
    });

    res.status(200).json({
      success: true,
      message: 'Doctor verification rejected.',
      data: {
        status: VERIFICATION_STATUS.REJECTED
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request Changes on Doctor Verification
// @route   PATCH /api/v1/admin/doctors/:id/request-changes
// @access  Protected (Admin only)
const requestDoctorChanges = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the changes or missing documentation requested.',
        code: 'NOTES_REQUIRED'
      });
    }

    const profile = await DoctorProfile.findOne({ user: doctorId });
    if (profile) {
      profile.verificationStatus = VERIFICATION_STATUS.CHANGES_REQUESTED;
      profile.isVerified = false;
      await profile.save();
    }

    let verification = await DoctorVerification.findOne({ doctor: doctorId });
    if (verification) {
      verification.status = VERIFICATION_STATUS.CHANGES_REQUESTED;
      verification.reviewedBy = req.user.id;
      verification.reviewedAt = new Date();
      verification.adminNotes = notes;
      verification.statusHistory.push({
        status: VERIFICATION_STATUS.CHANGES_REQUESTED,
        changedBy: req.user.id,
        reason: notes
      });
      await verification.save();
    }

    await recordAudit('DOCTOR_CHANGES_REQUESTED', req, doctorId, { notes });

    await createNotification({
      recipient: doctorId,
      sender: req.user.id,
      type: 'system',
      title: 'Verification Changes Requested',
      message: `Admin requested changes to your credentials: ${notes}`,
      link: '/doctor/verification',
      data: { doctorId, status: VERIFICATION_STATUS.CHANGES_REQUESTED }
    });

    res.status(200).json({
      success: true,
      message: 'Changes requested from doctor successfully.',
      data: {
        status: VERIFICATION_STATUS.CHANGES_REQUESTED
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suspend an Approved Doctor
// @route   PATCH /api/v1/admin/doctors/:id/suspend
// @access  Protected (Admin only)
const suspendDoctor = async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { reason } = req.body;

    const profile = await DoctorProfile.findOne({ user: doctorId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    profile.verificationStatus = VERIFICATION_STATUS.SUSPENDED;
    profile.isVerified = false;
    await profile.save();

    await recordAudit('DOCTOR_SUSPENDED', req, doctorId, {
      suspensionReason: reason || 'Administrative suspension'
    });

    res.status(200).json({
      success: true,
      message: 'Doctor suspended. Profile is immediately hidden from public listings.',
      data: {
        status: VERIFICATION_STATUS.SUSPENDED,
        isVerified: false
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Securely Stream Uploaded Verification Document (Admin only)
// @route   GET /api/v1/admin/verification-documents/:filename
// @access  Protected (Admin only)
const getSecureDocument = async (req, res, next) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, '..', 'uploads', 'documents', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Requested verification document was not found.',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. USER MANAGEMENT
// ==========================================

// @desc    Get Platform Users List with Search and Filtering
// @route   GET /api/v1/admin/users
// @access  Protected (Admin only)
const getUsers = async (req, res, next) => {
  try {
    const { role, search, status, page = 1, limit = 15 } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role.toLowerCase();
    }

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (search && search.trim()) {
      const term = escapeRegex(search.trim());
      query.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { city: { $regex: term, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      User.countDocuments(query)
    ]);

    // Attach doctor/shipping profile hints if relevant
    const doctorIds = users.filter(u => u.role === ROLES.DOCTOR).map(u => u._id);
    const shippingIds = users.filter(u => u.role === ROLES.SHIPPING).map(u => u._id);

    const [doctorProfiles, shippingProfiles] = await Promise.all([
      DoctorProfile.find({ user: { $in: doctorIds } }).select('specialization verificationStatus isVerified consultationFee rating').lean(),
      ShippingProfile.find({ user: { $in: shippingIds } }).select('companyName vehicleType isAvailable activeDeliveriesCount').lean()
    ]);

    const doctorProfileMap = new Map(doctorProfiles.filter(dp => dp && dp.user).map(dp => [dp.user.toString(), dp]));
    const shippingProfileMap = new Map(shippingProfiles.filter(sp => sp && sp.user).map(sp => [sp.user.toString(), sp]));

    const enrichedUsers = users.map(user => {
      const u = { ...user };
      if (u.role === ROLES.DOCTOR) {
        u.doctorProfile = doctorProfileMap.get(u._id.toString()) || null;
      } else if (u.role === ROLES.SHIPPING) {
        u.shippingProfile = shippingProfileMap.get(u._id.toString()) || null;
      }
      return u;
    });

    res.status(200).json({
      success: true,
      message: 'Platform users retrieved successfully.',
      data: {
        users: enrichedUsers,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle User Active / Inactive Status
// @route   PATCH /api/v1/admin/users/:id/status
// @access  Protected (Admin only)
const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deactivating themselves
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Administrative security boundary: You cannot deactivate your own administrative account.',
        code: 'CANNOT_SELF_DEACTIVATE'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Security boundary: Administrative accounts cannot be deactivated via this endpoint
    if (user.role === ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Administrative security boundary: Administrative accounts cannot be deactivated via this endpoint.',
        code: 'ADMIN_DEACTIVATION_FORBIDDEN'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    await recordAudit('USER_STATUS_TOGGLED', req, user._id, {
      newStatus: user.isActive ? 'active' : 'inactive',
      targetEmail: user.email,
      targetRole: user.role
    });

    res.status(200).json({
      success: true,
      message: `User account has been ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. APPOINTMENTS OVERSIGHT
// ==========================================

// @desc    Get All Appointments (Admin Oversight)
// @route   GET /api/v1/admin/appointments
// @access  Protected (Admin only)
const getAdminAppointments = async (req, res, next) => {
  try {
    const { status, consultationType, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (consultationType && consultationType !== 'all') {
      query.consultationType = consultationType;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    let appointments = await Appointment.find(query)
      .populate('patient', 'fullName email phone city')
      .populate('doctor', 'fullName email phone')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(take)
      .lean();

    // In-memory search filter if patient or doctor name is queried
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      appointments = appointments.filter(a =>
        a.patient?.fullName?.toLowerCase().includes(term) ||
        a.doctor?.fullName?.toLowerCase().includes(term) ||
        a.reason?.toLowerCase().includes(term)
      );
    }

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        appointments,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Update Appointment Status
// @route   PATCH /api/v1/admin/appointments/:id/status
// @access  Protected (Admin only)
const updateAdminAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason, notes } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        code: 'APPOINTMENT_NOT_FOUND'
      });
    }

    if (status) appointment.status = status;
    if (cancellationReason) appointment.cancellationReason = cancellationReason;
    if (notes) appointment.notes = notes;

    await appointment.save();

    await recordAudit('ADMIN_APPOINTMENT_STATUS_UPDATED', req, appointment._id, {
      newStatus: status,
      cancellationReason
    });

    res.status(200).json({
      success: true,
      message: 'Appointment updated by administrator.',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. MEDICAL RECORDS, PRESCRIPTIONS, TEST REPORTS
// ==========================================

// @desc    Get All Prescriptions across platform
// @route   GET /api/v1/admin/prescriptions
// @access  Protected (Admin only)
const getAdminPrescriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, search } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const query = {};
    if (search && search.trim()) {
      query.$or = [
        { clinicalAssessment: { $regex: search.trim(), $options: 'i' } },
        { advice: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [prescriptions, total] = await Promise.all([
      Prescription.find(query)
        .populate('doctor', 'fullName email phone')
        .populate('patient', 'fullName email phone dateOfBirth gender')
        .populate('appointment', 'date timeSlot consultationType status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Prescription.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        prescriptions,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get All Medical Records across platform
// @route   GET /api/v1/admin/records
// @access  Protected (Admin only)
const getAdminMedicalRecords = async (req, res, next) => {
  try {
    const { recordType, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (recordType && recordType !== 'all') {
      query.recordType = recordType;
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { summary: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [records, total] = await Promise.all([
      MedicalRecord.find(query)
        .populate('doctor', 'fullName email')
        .populate('patient', 'fullName email phone')
        .populate('appointment', 'date consultationType')
        .sort({ date: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      MedicalRecord.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        records,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get All Diagnostic Test Reports
// @route   GET /api/v1/admin/reports
// @access  Protected (Admin only)
const getAdminTestReports = async (req, res, next) => {
  try {
    const { status, category, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;

    if (search && search.trim()) {
      query.testName = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [reports, total] = await Promise.all([
      TestReport.find(query)
        .populate('doctor', 'fullName email phone')
        .populate('patient', 'fullName email phone')
        .populate('appointment', 'date consultationType')
        .sort({ date: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      TestReport.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        reports,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. MEDICINE ORDERS & SHIPPING LOGISTICS
// ==========================================

// @desc    Get All Medicine Orders (Admin Oversight)
// @route   GET /api/v1/admin/orders
// @access  Protected (Admin only)
const getAdminOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      query.$or = [
        { orderNumber: { $regex: search.trim(), $options: 'i' } },
        { trackingNumber: { $regex: search.trim(), $options: 'i' } },
        { 'deliveryAddress.city': { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [orders, total] = await Promise.all([
      MedicineOrder.find(query)
        .populate('patient', 'fullName email phone')
        .populate('doctor', 'fullName email')
        .populate('shippingPartner', 'fullName phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      MedicineOrder.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Shipping Partners List for Logistics Management
// @route   GET /api/v1/admin/shipping-partners
// @access  Protected (Admin only)
const getShippingPartners = async (req, res, next) => {
  try {
    const profiles = await ShippingProfile.find()
      .populate('user', 'fullName email phone city isActive')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        partners: profiles
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. NOTIFICATIONS & BROADCAST
// ==========================================

// @desc    Get System Notifications
// @route   GET /api/v1/admin/notifications
// @access  Protected (Admin only)
const getAdminNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [notifications, total] = await Promise.all([
      Notification.find()
        .populate('recipient', 'fullName email role')
        .populate('sender', 'fullName role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Notification.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Broadcast Notification / Announcement to Users
// @route   POST /api/v1/admin/notifications/broadcast
// @access  Protected (Admin only)
const broadcastNotification = async (req, res, next) => {
  try {
    const { title, message, targetRole = 'all', link = '/' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required for platform broadcast.',
        code: 'VALIDATION_ERROR'
      });
    }

    const userQuery = { isActive: true };
    if (targetRole !== 'all') {
      userQuery.role = targetRole.toLowerCase();
    }

    const recipients = await User.find(userQuery).select('_id');
    const createdNotifications = [];

    for (const r of recipients) {
      const notif = await createNotification({
        recipient: r._id,
        sender: req.user.id,
        type: 'system',
        title: title.trim(),
        message: message.trim(),
        link: link.trim()
      });
      if (notif) createdNotifications.push(notif);
    }

    await recordAudit('NOTIFICATION_BROADCAST', req, null, {
      title,
      targetRole,
      recipientCount: recipients.length
    });

    res.status(200).json({
      success: true,
      message: `Announcement broadcast successfully dispatched to ${recipients.length} user(s).`,
      data: {
        sentCount: recipients.length,
        targetRole
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. REVIEWS & MODERATION
// ==========================================

// @desc    Get All Reviews for Moderation
// @route   GET /api/v1/admin/reviews
// @access  Protected (Admin only)
const getAdminReviews = async (req, res, next) => {
  try {
    const { rating, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (rating && rating !== 'all') {
      query.rating = Number(rating);
    }

    if (search && search.trim()) {
      query.comment = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('patient', 'fullName email')
        .populate('doctor', 'fullName email')
        .populate('appointment', 'date consultationType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Review.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Moderate an Inappropriate Review
// @route   DELETE /api/v1/admin/reviews/:id
// @access  Protected (Admin only)
const deleteAdminReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.',
        code: 'REVIEW_NOT_FOUND'
      });
    }

    const doctorId = review.doctor;
    await Review.findByIdAndDelete(id);

    // Recalculate doctor rating
    const stats = await Review.aggregate([
      { $match: { doctor: doctorId } },
      {
        $group: {
          _id: '$doctor',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    const avg = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 5.0;
    const count = stats.length > 0 ? stats[0].reviewCount : 0;

    await DoctorProfile.findOneAndUpdate(
      { user: doctorId },
      { rating: avg, reviewCount: count, totalReviews: count }
    );

    await recordAudit('REVIEW_MODERATED_DELETE', req, id, {
      doctorId,
      reason: reason || 'Administrative content moderation'
    });

    res.status(200).json({
      success: true,
      message: 'Review deleted and doctor rating recalculated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 8. CONTACT MESSAGES
// ==========================================

// @desc    Get Contact Messages
// @route   GET /api/v1/admin/contact-messages
// @access  Protected (Admin only)
const getContactMessages = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { subject: { $regex: search.trim(), $options: 'i' } },
        { message: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [messages, total] = await Promise.all([
      ContactMessage.find(query)
        .populate('respondedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      ContactMessage.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        messages,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Contact Message Status / Add Response
// @route   PATCH /api/v1/admin/contact-messages/:id
// @access  Protected (Admin only)
const updateContactMessageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;

    const contact = await ContactMessage.findById(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact inquiry not found.',
        code: 'NOT_FOUND'
      });
    }

    if (status) contact.status = status;
    if (adminResponse !== undefined) {
      contact.adminResponse = adminResponse;
      contact.respondedBy = req.user.id;
      contact.respondedAt = new Date();
    }

    await contact.save();

    await recordAudit('CONTACT_MESSAGE_UPDATED', req, contact._id, {
      status: contact.status
    });

    res.status(200).json({
      success: true,
      message: 'Contact inquiry updated successfully.',
      data: contact
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 9. AUDIT LOGS
// ==========================================

// @desc    Get Platform Compliance Audit Logs
// @route   GET /api/v1/admin/audit-logs
// @access  Protected (Admin only)
const getAdminAuditLogs = async (req, res, next) => {
  try {
    const { action, page = 1, limit = 25 } = req.query;
    const query = {};

    if (action && action !== 'all') {
      query.action = action;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('performedBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 10. SYSTEM STATUS & CONFIG SUMMARY
// ==========================================

// @desc    Get Administrative System Status (Sanitized)
// @route   GET /api/v1/admin/system-status
// @access  Protected (Admin only)
const getAdminSystemStatus = async (req, res, next) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };

    const counts = await Promise.all([
      User.countDocuments(),
      Appointment.countDocuments(),
      MedicineOrder.countDocuments(),
      AuditLog.countDocuments(),
      ContactMessage.countDocuments({ status: 'new' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        server: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV || 'development'
        },
        database: {
          status: dbStatusMap[dbState] || 'Unknown',
          readyState: dbState
        },
        metrics: {
          totalUsers: counts[0],
          totalAppointments: counts[1],
          totalOrders: counts[2],
          totalAuditEntries: counts[3],
          newContactInquiries: counts[4]
        },
        securityBoundary: {
          adminRoleEnforced: true,
          publicRegistrationExcludesAdmin: true,
          credentialEncryptionActive: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Verification
  getPendingDoctorVerifications,
  getDoctorVerificationDetails,
  approveDoctorVerification,
  rejectDoctorVerification,
  requestDoctorChanges,
  suspendDoctor,
  getSecureDocument,
  // Users
  getUsers,
  toggleUserStatus,
  // Appointments
  getAdminAppointments,
  updateAdminAppointmentStatus,
  // Records & Prescriptions & Reports
  getAdminPrescriptions,
  getAdminMedicalRecords,
  getAdminTestReports,
  // Orders & Shipping
  getAdminOrders,
  getShippingPartners,
  // Notifications & Broadcast
  getAdminNotifications,
  broadcastNotification,
  // Reviews
  getAdminReviews,
  deleteAdminReview,
  // Contact Messages
  getContactMessages,
  updateContactMessageStatus,
  // Audit Logs
  getAdminAuditLogs,
  // System Status
  getAdminSystemStatus
};
