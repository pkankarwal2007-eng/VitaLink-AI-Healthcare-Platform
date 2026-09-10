const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAdminAnalytics,
  getDoctorAnalytics
} = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(protect);

router.get('/admin', authorize('admin'), getAdminAnalytics);
router.get('/doctor', authorize('doctor'), getDoctorAnalytics);

module.exports = router;
