const mongoose = require('mongoose');
const MedicineOrder = require('../models/MedicineOrder');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const ShippingAssignment = require('../models/ShippingAssignment');
const { ROLES, ORDER_STATUS } = require('../config/constants');
const { getIO } = require('../services/socketService');
const { createNotification } = require('../services/notificationService');
const { routeOrderToNearestPartner } = require('../services/dispatchService');
const { escapeRegex } = require('../utils/security');

/**
 * Generate human-readable unique order and tracking numbers
 */
const generateOrderNumbers = () => {
  const ts = Date.now().toString().slice(-6);
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${ts}-${rnd}`;
  const trackingNumber = `TRK-${Date.now().toString(36).toUpperCase()}-${rnd}`;
  return { orderNumber, trackingNumber };
};

/**
 * Create a new Medicine Order from a valid prescription
 * POST /api/v1/orders
 * Access: Authenticated Patient
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      prescriptionId,
      deliveryAddress,
      paymentMethod = 'cod',
      notes = ''
    } = req.body;

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Prescription ID is required to place a medicine order.'
      });
    }

    if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.pinCode) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Complete delivery address (fullName, phone, street, city, state, pinCode) is required.'
      });
    }

    // Verify prescription exists
    const prescription = await Prescription.findById(prescriptionId)
      .populate('doctor', 'fullName email phone')
      .populate('patient', 'fullName email phone');

    if (!prescription) {
      return res.status(404).json({
        success: false,
        code: 'PRESCRIPTION_NOT_FOUND',
        message: 'Prescription record not found.'
      });
    }

    // Ensure the patient placing order is the prescription owner
    if (prescription.patient._id.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only place medicine orders for your own prescriptions.'
      });
    }

    if (!prescription.medications || prescription.medications.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'EMPTY_PRESCRIPTION',
        message: 'This prescription contains no medications to order.'
      });
    }

    // Construct line items from prescription medications
    const items = prescription.medications.map(med => {
      const unitPrice = Number(med.price) || 50;
      const quantity = 1;
      return {
        name: med.name,
        dosage: med.dosage,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        instructions: med.instructions || 'After meals'
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryFee = 40;
    const totalAmount = subtotal + deliveryFee;

    const { orderNumber, trackingNumber } = generateOrderNumbers();
    const estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days

    const order = await MedicineOrder.create({
      orderNumber,
      trackingNumber,
      prescription: prescription._id,
      patient: req.user._id,
      doctor: prescription.doctor._id,
      items,
      deliveryAddress: {
        fullName: deliveryAddress.fullName.trim(),
        phone: deliveryAddress.phone.trim(),
        street: deliveryAddress.street.trim(),
        city: deliveryAddress.city.trim(),
        state: deliveryAddress.state.trim(),
        pinCode: deliveryAddress.pinCode.trim()
      },
      subtotal,
      deliveryFee,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'completed',
      status: ORDER_STATUS.CONFIRMED,
      statusHistory: [
        {
          status: ORDER_STATUS.PENDING,
          timestamp: new Date(),
          note: 'Order initiated from clinical prescription.',
          updatedBy: req.user._id
        },
        {
          status: ORDER_STATUS.CONFIRMED,
          timestamp: new Date(),
          note: 'Order confirmed and queued for pharmacy packaging.',
          updatedBy: req.user._id
        }
      ],
      estimatedDelivery,
      notes: notes.trim()
    });

    // Mark prescription as ordered
    await Prescription.findByIdAndUpdate(prescription._id, { orderedForDelivery: true });

    // Emit Socket notification
    const io = getIO();
    if (io) {
      io.to(`user:${req.user._id}`).emit('order-status-update', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        message: 'Your medicine order has been confirmed.'
      });
    }

    await createNotification({
      recipient: req.user._id,
      sender: null,
      type: 'order_update',
      title: 'Medicine Order Confirmed',
      message: `Your medicine order #${order.orderNumber} has been placed and confirmed.`,
      link: `/patient/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber }
    });

    // Automatically route order to nearest eligible shipping partner based on delivery location
    try {
      await routeOrderToNearestPartner(order);
    } catch (dispatchErr) {
      console.error('[VitaLink Dispatch] Error routing order to nearest partner:', dispatchErr);
    }

    const populated = await MedicineOrder.findById(order._id)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email')
      .populate('shippingPartner', 'fullName phone')
      .populate('prescription', 'clinicalAssessment advice');

    res.status(201).json({
      success: true,
      message: 'Medicine order placed and confirmed successfully.',
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get medicine orders list based on authenticated role
 * GET /api/v1/orders
 * Access: Patient, Doctor, Admin (Shipping partners must use /api/v1/shipping/orders)
 */
const getOrders = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (req.user.role === ROLES.PATIENT) {
      query.patient = req.user._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      query.doctor = req.user._id;
    } else if (req.user.role === ROLES.ADMIN) {
      if (req.query.patientId) query.patient = req.query.patientId;
      if (req.query.doctorId) query.doctor = req.query.doctorId;
      if (req.query.shippingPartnerId) query.shippingPartner = req.query.shippingPartnerId;
    } else {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Shipping partners must access orders via the shipping portal.'
      });
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { orderNumber: { $regex: escaped, $options: 'i' } },
        { trackingNumber: { $regex: escaped, $options: 'i' } },
        { 'deliveryAddress.city': { $regex: escaped, $options: 'i' } }
      ];
    }

    const orders = await MedicineOrder.find(query)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email')
      .populate('shippingPartner', 'fullName phone email')
      .populate('shippingProfile', 'companyName vehicleType vehicleNumber rating phone')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single medicine order details
 * GET /api/v1/orders/:id
 * Access: Patient owner, Doctor issuer, Admin, Assigned shipping partner
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await MedicineOrder.findById(id)
        .populate('patient', 'fullName email phone')
        .populate('doctor', 'fullName email')
        .populate('shippingPartner', 'fullName phone email')
        .populate('shippingProfile', 'companyName vehicleType vehicleNumber rating phone')
        .populate('prescription', 'clinicalAssessment advice createdAt');
    } else {
      order = await MedicineOrder.findOne({ orderNumber: id.toUpperCase() })
        .populate('patient', 'fullName email phone')
        .populate('doctor', 'fullName email')
        .populate('shippingPartner', 'fullName phone email')
        .populate('shippingProfile', 'companyName vehicleType vehicleNumber rating phone')
        .populate('prescription', 'clinicalAssessment advice createdAt');
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Medicine order not found.'
      });
    }

    // Access authorization
    const isPatient = order.patient._id.toString() === req.user._id.toString();
    const isDoctor = order.doctor._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    const isAssignedShipping = order.shippingPartner && order.shippingPartner._id.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor && !isAdmin && !isAssignedShipping) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this medicine order.'
      });
    }

    // If shipping partner, protect patient privacy (remove clinical assessment & doctor notes)
    if (isAssignedShipping && !isAdmin) {
      const sanitized = order.toObject();
      delete sanitized.prescription;
      return res.status(200).json({
        success: true,
        data: sanitized
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an order (allowed only if pending or confirmed)
 * PATCH /api/v1/orders/:id/cancel
 * Access: Patient owner or Admin
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by user' } = req.body;

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Medicine order not found.'
      });
    }

    // Authorization
    if (order.patient.toString() !== req.user._id.toString() && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only cancel your own orders.'
      });
    }

    // Check valid cancellation state
    if (order.status === ORDER_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        code: 'ORDER_ALREADY_CANCELLED',
        message: 'This order is already cancelled.'
      });
    }

    if (order.status === ORDER_STATUS.DELIVERED) {
      return res.status(400).json({
        success: false,
        code: 'ORDER_ALREADY_DELIVERED',
        message: 'Delivered orders cannot be cancelled.'
      });
    }

    if ([ORDER_STATUS.PACKED, ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED_UP, ORDER_STATUS.OUT_FOR_DELIVERY].includes(order.status) && req.user.role !== ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        code: 'CANNOT_CANCEL_ORDER',
        message: `Order is already ${order.status.replace('_', ' ')}. Please contact customer support to request cancellation.`
      });
    }

    order.status = ORDER_STATUS.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = reason.trim();
    order.statusHistory.push({
      status: ORDER_STATUS.CANCELLED,
      timestamp: new Date(),
      note: `Order cancelled: ${reason.trim()}`,
      updatedBy: req.user._id
    });

    await order.save();

    // Cancel any active shipping assignments
    await ShippingAssignment.updateMany(
      { order: order._id, status: { $in: ['offered', 'accepted'] } },
      { $set: { status: 'cancelled' } }
    );

    // Re-enable prescription ordering
    await Prescription.findByIdAndUpdate(order.prescription, { orderedForDelivery: false });

    // Emit socket event
    const io = getIO();
    if (io) {
      io.to(`user:${order.patient}`).emit('order-status-update', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUS.CANCELLED,
        message: `Order cancelled: ${reason.trim()}`
      });
      if (order.shippingPartner) {
        io.to(`user:${order.shippingPartner}`).emit('order-status-update', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: ORDER_STATUS.CANCELLED,
          message: `Order ${order.orderNumber} has been cancelled.`
        });
      }
    }

    await createNotification({
      recipient: order.patient,
      sender: req.user._id,
      type: 'order_update',
      title: 'Order Cancelled',
      message: `Your medicine order #${order.orderNumber} was cancelled.`,
      link: `/patient/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber, reason: reason.trim() }
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public/authenticated delivery tracking timeline
 * GET /api/v1/orders/:id/track
 */
const trackOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await MedicineOrder.findById(id)
        .populate('shippingPartner', 'fullName phone')
        .populate('shippingProfile', 'companyName vehicleType vehicleNumber rating phone')
        .lean();
    } else {
      order = await MedicineOrder.findOne({
        $or: [{ trackingNumber: id.toUpperCase() }, { orderNumber: id.toUpperCase() }]
      })
        .populate('shippingPartner', 'fullName phone')
        .populate('shippingProfile', 'companyName vehicleType vehicleNumber rating phone')
        .lean();
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'TRACKING_NOT_FOUND',
        message: 'No shipment found for this identifier.'
      });
    }

    // Access authorization: Patient owner, Doctor issuer, Assigned shipping partner, or Admin
    const isPatient = order.patient?.toString() === req.user._id.toString();
    const isDoctor = order.doctor?.toString() === req.user._id.toString();
    const isAssignedShipping = order.shippingPartner && order.shippingPartner._id
      ? order.shippingPartner._id.toString() === req.user._id.toString()
      : order.shippingPartner?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAssignedShipping && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this shipment tracking information.'
      });
    }

    // Safe sanitized response for tracking
    const trackingData = {
      orderNumber: order.orderNumber,
      trackingNumber: order.trackingNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt,
      deliveryCity: order.deliveryAddress?.city,
      deliveryState: order.deliveryAddress?.state,
      deliveryPinCode: order.deliveryAddress?.pinCode,
      recipientName: order.deliveryAddress?.fullName,
      carrier: order.shippingProfile?.companyName || order.shippingPartner?.fullName || 'VitaLink Logistics Partner',
      carrierPhone: order.shippingProfile?.phone || order.shippingPartner?.phone || null,
      vehicleType: order.shippingProfile?.vehicleType || 'Courier',
      vehicleNumber: order.shippingProfile?.vehicleNumber || null,
      totalItems: order.items?.length || 0,
      createdAt: order.createdAt
    };

    res.status(200).json({
      success: true,
      data: trackingData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  cancelOrder,
  trackOrder
};
