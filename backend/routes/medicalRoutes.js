const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { reportUpload } = require('../middleware/uploadMiddleware');
const {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  getTestReports,
  recommendTest,
  uploadTestReport,
  getReportFile,
  reviewTestReport
} = require('../controllers/medicalController');

// All medical routes require authentication and strictly exclude shipping role
router.use(protect);
router.use(authorize('patient', 'doctor', 'admin'));

// Prescriptions
router.post('/prescriptions', authorize('doctor'), createPrescription);
router.get('/prescriptions', getPrescriptions);
router.get('/prescriptions/:id', getPrescriptionById);

// Medical Records
router.get('/records', getMedicalRecords);
router.get('/records/:id', getMedicalRecordById);
router.post('/records', authorize('doctor'), createMedicalRecord);

// Test Reports
router.get('/reports', getTestReports);
router.post('/reports/recommend', authorize('doctor'), recommendTest);
router.post('/reports/:id/upload', authorize('patient'), reportUpload.single('report'), uploadTestReport);
router.get('/reports/:id/file', getReportFile);
router.patch('/reports/:id/review', authorize('doctor'), reviewTestReport);

module.exports = router;
