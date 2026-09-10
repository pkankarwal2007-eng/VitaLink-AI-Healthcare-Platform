const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  trackOrder
} = require('../controllers/orderController');

// Tracking endpoint accessible to track orders
router.get('/:id/track', protect, trackOrder);

// Authenticated order management
router.post('/', protect, authorize('patient', 'admin'), createOrder);
router.get('/', protect, authorize('patient', 'doctor', 'admin'), getOrders);
router.get('/:id', protect, getOrderById);
router.patch('/:id/cancel', protect, authorize('patient', 'admin'), cancelOrder);

module.exports = router;
