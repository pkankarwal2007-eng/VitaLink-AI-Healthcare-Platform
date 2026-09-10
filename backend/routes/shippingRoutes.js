const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getShippingProfile,
  updateShippingProfile,
  getAssignedOrders,
  getAvailableOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  adminPackOrder,
  adminAssignOrder,
  reconcileOrders
} = require('../controllers/shippingController');

// All shipping routes require authentication
router.use(protect);

// Shipping Partner Profile
router.get('/profile', authorize('shipping'), getShippingProfile);
router.put('/profile', authorize('shipping'), updateShippingProfile);

// Shipping Partner Order Operations
router.get('/orders', authorize('shipping'), getAssignedOrders);
router.get('/orders/available', authorize('shipping'), getAvailableOrders);
router.post('/orders/reconcile', authorize('shipping', 'admin'), reconcileOrders);
router.patch('/orders/:id/accept', authorize('shipping'), acceptOrder);
router.patch('/orders/:id/reject', authorize('shipping'), rejectOrder);
router.patch('/orders/:id/status', authorize('shipping', 'admin'), updateOrderStatus);

// Admin Logistics Management
router.patch('/orders/:id/pack', authorize('admin'), adminPackOrder);
router.post('/orders/:id/assign', authorize('admin'), adminAssignOrder);

module.exports = router;
