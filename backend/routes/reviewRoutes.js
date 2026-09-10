const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createReview,
  getDoctorReviews,
  getAppointmentReview
} = require('../controllers/reviewController');

// Public lookup of doctor reviews & rating breakdown
router.get('/doctor/:doctorId', getDoctorReviews);

// Authenticated reviews endpoints
router.get('/appointment/:appointmentId', protect, getAppointmentReview);
router.post('/', protect, authorize('patient'), createReview);

module.exports = router;
