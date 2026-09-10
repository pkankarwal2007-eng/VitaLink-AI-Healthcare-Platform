const express = require('express');
const router = express.Router();
const {
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
  // Records, Prescriptions, Reports
  getAdminPrescriptions,
  getAdminMedicalRecords,
  getAdminTestReports,
  // Orders & Shipping
  getAdminOrders,
  getShippingPartners,
  // Notifications
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
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes strictly require valid JWT and role === 'admin'
router.use(protect);
router.use(authorize('admin'));

// 1. Verification Management
router.get('/doctors/pending', getPendingDoctorVerifications);
router.get('/doctors/:id/verification', getDoctorVerificationDetails);
router.patch('/doctors/:id/approve', approveDoctorVerification);
router.patch('/doctors/:id/reject', rejectDoctorVerification);
router.patch('/doctors/:id/request-changes', requestDoctorChanges);
router.patch('/doctors/:id/suspend', suspendDoctor);
router.get('/verification-documents/:filename', getSecureDocument);

// 2. User Management
router.get('/users', getUsers);
router.patch('/users/:id/status', toggleUserStatus);

// 3. Appointments Oversight
router.get('/appointments', getAdminAppointments);
router.patch('/appointments/:id/status', updateAdminAppointmentStatus);

// 4. Clinical Prescriptions, Records & Reports
router.get('/prescriptions', getAdminPrescriptions);
router.get('/records', getAdminMedicalRecords);
router.get('/reports', getAdminTestReports);

// 5. Orders & Logistics
router.get('/orders', getAdminOrders);
router.get('/shipping-partners', getShippingPartners);

// 6. System Notifications & Broadcast
router.get('/notifications', getAdminNotifications);
router.post('/notifications/broadcast', broadcastNotification);

// 7. Reviews Moderation
router.get('/reviews', getAdminReviews);
router.delete('/reviews/:id', deleteAdminReview);

// 8. Contact Inquiries Management
router.get('/contact-messages', getContactMessages);
router.patch('/contact-messages/:id', updateContactMessageStatus);

// 9. Compliance Audit Trail
router.get('/audit-logs', getAdminAuditLogs);

// 10. System Status & Metrics
router.get('/system-status', getAdminSystemStatus);

module.exports = router;
