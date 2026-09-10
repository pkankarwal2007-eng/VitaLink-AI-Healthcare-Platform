const mongoose = require('mongoose');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');
const { ROLES, APPOINTMENT_STATUS } = require('../config/constants');
const { createNotification } = require('../services/notificationService');

/**
 * Recalculate and update the doctor's average rating on their DoctorProfile
 */
const updateDoctorProfileRating = async (doctorId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { doctor: new mongoose.Types.ObjectId(doctorId) } },
      {
        $group: {
          _id: '$doctor',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    const avg = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
    const count = stats.length > 0 ? stats[0].reviewCount : 0;

    await DoctorProfile.findOneAndUpdate(
      { user: doctorId },
      { rating: avg, reviewCount: count, totalReviews: count }
    );
  } catch (err) {
    console.error('[UpdateDoctorRating Error]', err.message);
  }
};

/**
 * Submit a review for a completed consultation appointment
 * POST /api/v1/reviews
 * Access: Authenticated Patient
 */
const createReview = async (req, res, next) => {
  try {
    const { appointmentId, rating, comment = '' } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Appointment ID is required.'
      });
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Rating must be a numeric value between 1 and 5.'
      });
    }

    // Verify appointment exists
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'fullName email')
      .populate('patient', 'fullName email');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    // Verify ownership
    if (appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only review your own appointments.'
      });
    }

    // Must be completed
    if (appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        code: 'APPOINTMENT_NOT_COMPLETED',
        message: 'You can only review consultations that have been completed.'
      });
    }

    // Prevent duplicate review for the same appointment
    const existing = await Review.findOne({ appointment: appointmentId });
    if (existing) {
      return res.status(400).json({
        success: false,
        code: 'DUPLICATE_REVIEW',
        message: 'A review has already been submitted for this consultation appointment.'
      });
    }

    const review = await Review.create({
      patient: req.user._id,
      doctor: appointment.doctor._id,
      appointment: appointment._id,
      rating: numRating,
      comment: comment.trim()
    });

    // Update aggregated rating on DoctorProfile
    await updateDoctorProfileRating(appointment.doctor._id);

    // Notify doctor of new feedback
    await createNotification({
      recipient: appointment.doctor._id,
      sender: req.user._id,
      type: 'review_received',
      title: 'New Patient Review Received',
      message: `${req.user.fullName} rated your consultation ${numRating} stars: "${comment.trim().slice(0, 80)}..."`,
      link: '/doctor',
      data: { reviewId: review._id, appointmentId: appointment._id, rating: numRating }
    });

    const populated = await Review.findById(review._id)
      .populate('patient', 'fullName avatar')
      .populate('doctor', 'fullName')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Consultation review submitted successfully.',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reviews, average rating, and star breakdown for a doctor
 * GET /api/v1/reviews/doctor/:doctorId
 * Access: Public
 */
const getDoctorReviews = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const docObjectId = new mongoose.Types.ObjectId(doctorId);

    const [reviews, total, ratingStats] = await Promise.all([
      Review.find({ doctor: docObjectId })
        .populate('patient', 'fullName avatar city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Review.countDocuments({ doctor: docObjectId }),
      Review.aggregate([
        { $match: { doctor: docObjectId } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Compute star breakdown
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    ratingStats.forEach(item => {
      if (breakdown[item._id] !== undefined) {
        breakdown[item._id] = item.count;
      }
      totalScore += item._id * item.count;
    });

    const averageRating = total > 0 ? Math.round((totalScore / total) * 10) / 10 : 0;

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      averageRating,
      breakdown,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take) || 1,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get review for a specific appointment (to check if reviewed)
 * GET /api/v1/reviews/appointment/:appointmentId
 * Access: Authenticated
 */
const getAppointmentReview = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const review = await Review.findOne({ appointment: appointmentId })
      .populate('patient', 'fullName avatar')
      .lean();

    res.status(200).json({
      success: true,
      data: review || null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getDoctorReviews,
  getAppointmentReview
};
