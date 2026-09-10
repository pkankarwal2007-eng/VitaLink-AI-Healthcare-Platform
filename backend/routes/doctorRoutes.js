const express = require('express');
const router = express.Router();
const {
  getMyDoctorProfile,
  updateDoctorProfile,
  submitVerification,
  getPublicDoctors,
  getPublicDoctorById,
  getDoctorAvailableSlots
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { documentUpload } = require('../middleware/uploadMiddleware');

// Protected Doctor Profile Management (MUST precede parameterized /:id routes)
router.get('/profile/me', protect, authorize('doctor'), getMyDoctorProfile);
router.put('/profile', protect, authorize('doctor'), updateDoctorProfile);

// Public Doctor Discovery Endpoints
router.get('/', getPublicDoctors);
router.get('/:id/slots', getDoctorAvailableSlots);
router.get('/:id', getPublicDoctorById);

// Protected Doctor Verification Submission with Multi-Document Upload
router.post(
  '/verification',
  protect,
  authorize('doctor'),
  documentUpload.fields([
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'medicalLicense', maxCount: 1 },
    { name: 'aadhaarCard', maxCount: 1 },
    { name: 'other', maxCount: 1 }
  ]),
  submitVerification
);

module.exports = router;
