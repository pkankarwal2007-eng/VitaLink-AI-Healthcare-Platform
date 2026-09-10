const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  acceptAppointment,
  suggestAppointmentTime,
  rejectAppointment,
  patientAcceptSuggestedTime,
  patientDeclineSuggestedTime,
  getDoctorSchedule
} = require('../controllers/appointmentController');

// All appointment routes require authentication
router.use(protect);

// Book appointment - Patients only
router.post('/', authorize('patient'), bookAppointment);

// List user's appointments (Patient or Doctor)
router.get('/my', getMyAppointments);
router.get('/', getMyAppointments);

// Doctor schedule & slot view (placed before /:id to prevent route shadowing)
router.get('/schedule/view', authorize('doctor', 'admin'), getDoctorSchedule);

// Get specific appointment
router.get('/:id', getAppointmentById);

// Update status (Doctor or Admin)
router.patch('/:id/status', authorize('doctor', 'admin'), updateAppointmentStatus);

// Doctor review actions on pending appointments
router.patch('/:id/accept', authorize('doctor'), acceptAppointment);
router.patch('/:id/suggest-time', authorize('doctor'), suggestAppointmentTime);
router.patch('/:id/reject', authorize('doctor'), rejectAppointment);

// Patient response actions on suggested time
router.patch('/:id/patient-accept', authorize('patient'), patientAcceptSuggestedTime);
router.patch('/:id/patient-decline', authorize('patient'), patientDeclineSuggestedTime);

// Cancel appointment (Patient, Doctor, or Admin)
router.patch('/:id/cancel', cancelAppointment);

module.exports = router;
