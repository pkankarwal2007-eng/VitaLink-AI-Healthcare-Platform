const mongoose = require('mongoose');
const MedicineOrder = require('../models/MedicineOrder');
const ShippingProfile = require('../models/ShippingProfile');
const ShippingAssignment = require('../models/ShippingAssignment');
const User = require('../models/User');
const { ROLES, ORDER_STATUS } = require('../config/constants');
const { getIO } = require('../services/socketService');
const { createNotification } = require('../services/notificationService');
const {
  handlePartnerRejection,
  reconcileUnassignedOrders
} = require('../services/dispatchService');
const { escapeRegex } = require('../utils/security');

/**
 * Get or create shipping profile for authenticated shipping partner
 * GET /api/v1/shipping/profile
 * Access: Shipping Partner
 */
const getShippingProfile = async (req, res, next) => {
  try {
    let profile = await ShippingProfile.findOne({ user: req.user._id });

    if (!profile) {
      profile = await ShippingProfile.create({
        user: req.user._id,
        companyName: req.user.fullName || 'VitaLink Courier Express',
        phone: req.user.phone || '',
        city: req.user.city || 'Mumbai',
        state: req.user.state || 'Maharashtra',
        pinCode: req.user.pinCode || '',
        serviceAddress: req.user.address || '',
        serviceCities: [req.user.city || 'Mumbai'],
        servicePincodes: req.user.pinCode ? [req.user.pinCode] : [],
        isAvailable: true
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipping partner profile
 * PUT /api/v1/shipping/profile
 * Access: Shipping Partner
 */
const updateShippingProfile = async (req, res, next) => {
  try {
    const {
      companyName,
      vehicleType,
      vehicleNumber,
      serviceCities,
      servicePincodes,
      isAvailable,
      phone,
      serviceAddress,
      city,
      state,
      pinCode,
      latitude,
      longitude,
      serviceRadiusKm,
      maxActiveCapacity
    } = req.body;

    let profile = await ShippingProfile.findOne({ user: req.user._id });

    if (!profile) {
      profile = new ShippingProfile({ user: req.user._id });
    }

    if (companyName !== undefined) profile.companyName = companyName.trim();
    if (vehicleType !== undefined) profile.vehicleType = vehicleType;
    if (vehicleNumber !== undefined) profile.vehicleNumber = vehicleNumber.trim();
    if (Array.isArray(serviceCities)) profile.serviceCities = serviceCities;
    if (Array.isArray(servicePincodes)) profile.servicePincodes = servicePincodes;
    if (isAvailable !== undefined) profile.isAvailable = Boolean(isAvailable);
    if (phone !== undefined) profile.phone = phone.trim();
    if (serviceAddress !== undefined) profile.serviceAddress = serviceAddress.trim();
    if (city !== undefined) profile.city = city.trim();
    if (state !== undefined) profile.state = state.trim();
    if (pinCode !== undefined) profile.pinCode = pinCode.trim();
    if (latitude !== undefined) profile.latitude = Number(latitude) || null;
    if (longitude !== undefined) profile.longitude = Number(longitude) || null;
    if (serviceRadiusKm !== undefined) profile.serviceRadiusKm = Number(serviceRadiusKm) || 30;
    if (maxActiveCapacity !== undefined) profile.maxActiveCapacity = Number(maxActiveCapacity) || 10;

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Shipping profile updated successfully.',
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders assigned to the authenticated shipping partner
 * GET /api/v1/shipping/orders
 * Access: Shipping Partner
 */
const getAssignedOrders = async (req, res, next) => {
  try {
    const { status = 'all', search } = req.query;
    const query = { shippingPartner: req.user._id };

    if (status === 'active') {
      query.status = {
        $in: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED_UP, ORDER_STATUS.OUT_FOR_DELIVERY]
      };
    } else if (status === 'history') {
      query.status = {
        $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED]
      };
    } else if (status !== 'all' && Object.values(ORDER_STATUS).includes(status)) {
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
      .sort({ updatedAt: -1 })
      .lean();

    // Data Privacy: sanitize order output for shipping partner
    const sanitizedOrders = orders.map(order => {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        status: order.status,
        statusHistory: order.statusHistory,
        deliveryAddress: order.deliveryAddress,
        items: order.items.map(i => ({
          name: i.name,
          dosage: i.dosage,
          quantity: i.quantity,
          instructions: i.instructions
        })),
        totalItems: order.items.length,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        assignedAt: order.assignedAt,
        acceptedAt: order.acceptedAt,
        pickedUpAt: order.pickedUpAt,
        outForDeliveryAt: order.outForDeliveryAt,
        deliveredAt: order.deliveredAt,
        estimatedDelivery: order.estimatedDelivery,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      count: sanitizedOrders.length,
      data: sanitizedOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get packed unassigned orders available in shipping partner's service area or offered to partner
 * GET /api/v1/shipping/orders/available
 * Access: Shipping Partner
 */
const getAvailableOrders = async (req, res, next) => {
  try {
    // Lazily reconcile any unassigned orders
    try {
      await reconcileUnassignedOrders();
    } catch (e) {
      console.error('[VitaLink Dispatch] Reconcile error:', e);
    }

    const partnerId = req.user._id;
    const profile = await ShippingProfile.findOne({ user: partnerId });
    const serviceCities = profile?.serviceCities?.length
      ? profile.serviceCities
      : [req.user.city || 'Mumbai'];

    // Find orders:
    // 1. Offered directly to this shipping partner
    // 2. OR unassigned in their service city, not rejected by this partner
    const orders = await MedicineOrder.find({
      status: { $in: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED] },
      shippingPartner: null,
      'rejectedPartners.partner': { $ne: partnerId },
      $or: [
        { offeredTo: partnerId },
        {
          offeredTo: null,
          'deliveryAddress.city': { $in: serviceCities.map((c) => new RegExp(`^${c}$`, 'i')) }
        }
      ]
    })
      .sort({ createdAt: 1 })
      .lean();

    // Fetch assignments to retrieve distance and match details
    const orderIds = orders.map((o) => o._id);
    const assignments = await ShippingAssignment.find({
      order: { $in: orderIds },
      shippingPartner: partnerId,
      status: 'offered'
    }).lean();

    const assignmentMap = new Map();
    assignments.forEach((a) => assignmentMap.set(a.order.toString(), a));

    // Sanitize for privacy: provide operational logistics data without exposing medical records
    const sanitized = orders.map((order) => {
      const assignment = assignmentMap.get(order._id.toString());
      const isDirectOffer =
        (order.offeredTo && order.offeredTo.toString() === partnerId.toString()) ||
        Boolean(assignment);

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        trackingNumber: order.trackingNumber,
        status: order.status,
        dispatchStatus: order.dispatchStatus || (isDirectOffer ? 'offered' : 'unassigned'),
        deliveryAddress: order.deliveryAddress,
        items: (order.items || []).map((i) => ({
          name: i.name,
          dosage: i.dosage,
          quantity: i.quantity,
          instructions: i.instructions || 'After meals'
        })),
        totalItems: (order.items || []).length,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        distanceKm: assignment?.distanceKm || (isDirectOffer ? 5.0 : null),
        matchType: assignment?.matchType || (isDirectOffer ? 'city' : 'service_area'),
        isDirectOffer,
        offerExpiresAt: order.offerExpiresAt || assignment?.expiresAt || null
      };
    });

    res.status(200).json({
      success: true,
      count: sanitized.length,
      data: sanitized
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Shipping partner accepts an assigned or available order
 * PATCH /api/v1/shipping/orders/:id/accept
 * Access: Shipping Partner
 */
const acceptOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const partnerId = req.user._id;

    const profile = await ShippingProfile.findOne({ user: partnerId });

    // Atomic claim with concurrency protection:
    // Guarantees that two partners cannot simultaneously claim the same package
    const order = await MedicineOrder.findOneAndUpdate(
      {
        _id: id,
        $and: [
          {
            $or: [
              { status: { $in: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED] } },
              { status: ORDER_STATUS.ASSIGNED, shippingPartner: partnerId }
            ]
          },
          {
            $or: [{ shippingPartner: null }, { shippingPartner: partnerId }]
          },
          {
            $or: [{ offeredTo: partnerId }, { offeredTo: null }, { offeredTo: { $exists: false } }]
          }
        ]
      },
      {
        $set: {
          shippingPartner: partnerId,
          shippingProfile: profile ? profile._id : null,
          status: ORDER_STATUS.ASSIGNED,
          dispatchStatus: 'assigned',
          acceptedAt: new Date(),
          offeredTo: null,
          offerExpiresAt: null
        },
        $push: {
          statusHistory: {
            status: ORDER_STATUS.ASSIGNED,
            timestamp: new Date(),
            note: `Accepted by courier partner ${req.user.fullName}.`,
            updatedBy: partnerId
          }
        }
      },
      { new: true }
    );

    if (!order) {
      const existing = await MedicineOrder.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found.'
        });
      }
      if (existing.shippingPartner && existing.shippingPartner.toString() !== partnerId.toString()) {
        return res.status(403).json({
          success: false,
          code: 'ORDER_ALREADY_CLAIMED',
          message: 'This order has already been claimed by another shipping partner.'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot accept order with status "${existing.status}".`
      });
    }

    // Update ShippingAssignment record
    await ShippingAssignment.findOneAndUpdate(
      { order: order._id, shippingPartner: partnerId },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    // Cancel any competing offers to other partners
    await ShippingAssignment.updateMany(
      { order: order._id, shippingPartner: { $ne: partnerId }, status: 'offered' },
      { $set: { status: 'cancelled' } }
    );

    // Increment active orders in profile
    if (profile) {
      await ShippingProfile.findByIdAndUpdate(profile._id, { $inc: { activeOrdersCount: 1 } });
    }

    // Socket notification to patient
    const io = getIO();
    if (io) {
      io.to(`user:${order.patient}`).emit('order-status-update', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUS.ASSIGNED,
        message: `Courier partner ${req.user.fullName} has accepted your order.`
      });
    }

    await createNotification({
      recipient: order.patient,
      sender: partnerId,
      type: 'order_update',
      title: 'Order Assigned to Courier',
      message: `Courier partner ${req.user.fullName} has accepted your medicine order #${order.orderNumber}.`,
      link: `/patient/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber }
    });

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully.',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Shipping partner rejects an assigned or offered order
 * PATCH /api/v1/shipping/orders/:id/reject
 * Access: Shipping Partner
 */
const rejectOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Courier partner unavailable' } = req.body;
    const partnerId = req.user._id;

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.'
      });
    }

    const isOffered = order.offeredTo && order.offeredTo.toString() === partnerId.toString();
    const isAssigned = order.shippingPartner && order.shippingPartner.toString() === partnerId.toString();

    if (!isOffered && !isAssigned) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only reject orders offered or assigned to you.'
      });
    }

    if (
      order.status !== ORDER_STATUS.ASSIGNED &&
      order.status !== ORDER_STATUS.CONFIRMED &&
      order.status !== ORDER_STATUS.PACKED
    ) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Cannot reject an order that has already progressed past assignment.'
      });
    }

    // Handle partner rejection and immediately route to next-nearest candidate
    const result = await handlePartnerRejection(id, partnerId, reason);
    const updatedOrder = result.order || (await MedicineOrder.findById(id));

    res.status(200).json({
      success: true,
      message: 'Order assignment rejected and re-routed to next available courier partner.',
      data: updatedOrder,
      routing: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Shipping partner updates delivery status (picked_up, out_for_delivery, delivered)
 * PATCH /api/v1/shipping/orders/:id/status
 * Access: Shipping Partner or Admin
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note = '', location = '' } = req.body;

    if (!status || !Object.values(ORDER_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: `Valid status required: ${Object.values(ORDER_STATUS).join(', ')}`
      });
    }

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.'
      });
    }

    // Authorization: must be assigned partner or admin
    const isAssigned = order.shippingPartner && order.shippingPartner.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isAssigned && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not authorized to update this order status.'
      });
    }

    // Terminal states cannot be changed
    if (order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        code: 'TERMINAL_STATUS',
        message: `Order is already ${order.status} and cannot be modified.`
      });
    }

    // Validate sequential progression rules
    const current = order.status;
    let isValidTransition = false;
    let defaultNote = '';

    switch (status) {
      case ORDER_STATUS.PICKED_UP:
        if (current === ORDER_STATUS.ASSIGNED) {
          isValidTransition = true;
          order.pickedUpAt = new Date();
          order.dispatchStatus = 'in_transit';
          defaultNote = 'Package picked up from VitaLink pharmacy hub.';
        }
        break;

      case ORDER_STATUS.OUT_FOR_DELIVERY:
        if (current === ORDER_STATUS.PICKED_UP) {
          isValidTransition = true;
          order.outForDeliveryAt = new Date();
          order.dispatchStatus = 'in_transit';
          defaultNote = 'Package is out for delivery with courier partner.';
        }
        break;

      case ORDER_STATUS.DELIVERED:
        if (current === ORDER_STATUS.OUT_FOR_DELIVERY) {
          isValidTransition = true;
          order.deliveredAt = new Date();
          order.dispatchStatus = 'delivered';
          order.paymentStatus = 'completed'; // COD or prepaid fulfilled
          defaultNote = 'Package successfully delivered to recipient.';
        }
        break;

      default:
        // Other transitions handled by specific endpoints (e.g. cancel, accept)
        isValidTransition = false;
    }

    if (!isValidTransition && !isAdmin) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS_TRANSITION',
        message: `Invalid status transition from "${current}" to "${status}". Must follow: Assigned -> Picked Up -> Out for Delivery -> Delivered.`
      });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note.trim() || defaultNote,
      updatedBy: req.user._id,
      location: location.trim()
    });

    await order.save();

    // If delivered, update courier statistics and complete shipping assignment
    if (status === ORDER_STATUS.DELIVERED && order.shippingPartner) {
      await ShippingAssignment.updateMany(
        { order: order._id, shippingPartner: order.shippingPartner, status: 'accepted' },
        { $set: { status: 'completed' } }
      );
      await ShippingProfile.findOneAndUpdate(
        { user: order.shippingPartner },
        {
          $inc: {
            totalDeliveredCount: 1,
            activeOrdersCount: -1
          }
        }
      );
    }

    // Socket notification to patient
    const io = getIO();
    if (io) {
      io.to(`user:${order.patient}`).emit('order-status-update', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status,
        message: defaultNote || `Order status updated to ${status.replace('_', ' ')}.`
      });
    }

    // Real notification to patient
    let notifTitle = 'Order Update';
    let notifMessage = defaultNote || `Order status updated to ${status.replace('_', ' ')}.`;
    if (status === ORDER_STATUS.PICKED_UP) {
      notifTitle = 'Order Picked Up';
      notifMessage = `Your medicine order #${order.orderNumber} has been picked up from the pharmacy.`;
    } else if (status === ORDER_STATUS.OUT_FOR_DELIVERY) {
      notifTitle = 'Order Out for Delivery';
      notifMessage = `Your medicine order #${order.orderNumber} is out for delivery with ${req.user.fullName}.`;
    } else if (status === ORDER_STATUS.DELIVERED) {
      notifTitle = 'Order Delivered';
      notifMessage = `Your medicine order #${order.orderNumber} has been successfully delivered.`;
    }

    await createNotification({
      recipient: order.patient,
      sender: req.user._id,
      type: 'delivery_update',
      title: notifTitle,
      message: notifMessage,
      link: `/patient/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber, status }
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin or Pharmacy marks order as packed
 * PATCH /api/v1/shipping/orders/:id/pack
 * Access: Admin
 */
const adminPackOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.'
      });
    }

    if (order.status !== ORDER_STATUS.CONFIRMED) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot pack an order with status "${order.status}". Must be confirmed.`
      });
    }

    order.status = ORDER_STATUS.PACKED;
    order.statusHistory.push({
      status: ORDER_STATUS.PACKED,
      timestamp: new Date(),
      note: 'Medicines verified and packed securely in tamper-proof packaging.',
      updatedBy: req.user._id
    });

    await order.save();

    const io = getIO();
    if (io) {
      io.to(`user:${order.patient}`).emit('order-status-update', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUS.PACKED,
        message: 'Your medicines have been packed and are ready for courier pickup.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order marked as packed.',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin assigns order to a specific shipping partner
 * POST /api/v1/shipping/orders/:id/assign
 * Access: Admin
 */
const adminAssignOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { shippingPartnerId } = req.body;

    if (!shippingPartnerId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Shipping partner user ID is required.'
      });
    }

    const partner = await User.findById(shippingPartnerId);
    if (!partner || partner.role !== ROLES.SHIPPING) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SHIPPING_PARTNER',
        message: 'Specified user is not an active shipping partner.'
      });
    }

    const order = await MedicineOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found.'
      });
    }

    if (order.status !== ORDER_STATUS.PACKED && order.status !== ORDER_STATUS.CONFIRMED) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS_TRANSITION',
        message: `Order with status "${order.status}" cannot be assigned. Must be confirmed or packed.`
      });
    }

    const profile = await ShippingProfile.findOne({ user: partner._id });

    order.shippingPartner = partner._id;
    if (profile) order.shippingProfile = profile._id;
    order.status = ORDER_STATUS.ASSIGNED;
    order.assignedAt = new Date();
    order.statusHistory.push({
      status: ORDER_STATUS.ASSIGNED,
      timestamp: new Date(),
      note: `Delivery assigned to partner ${partner.fullName}.`,
      updatedBy: req.user._id
    });

    await order.save();

    if (profile) {
      await ShippingProfile.findByIdAndUpdate(profile._id, { $inc: { activeOrdersCount: 1 } });
    }

    const io = getIO();
    if (io) {
      io.to(`user:${partner._id}`).emit('new-shipping-assignment', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        deliveryCity: order.deliveryAddress.city
      });
      io.to(`user:${order.patient}`).emit('order-status-update', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUS.ASSIGNED,
        message: `Assigned to delivery partner ${partner.fullName}.`
      });
    }

    // Real notification to shipping partner
    await createNotification({
      recipient: partner._id,
      sender: req.user._id,
      type: 'order_update',
      title: 'New Order Assigned',
      message: `Delivery order #${order.orderNumber} in ${order.deliveryAddress.city} has been assigned to you.`,
      link: '/shipping/orders',
      data: { orderId: order._id, orderNumber: order.orderNumber }
    });

    // Real notification to patient
    await createNotification({
      recipient: order.patient,
      sender: req.user._id,
      type: 'order_update',
      title: 'Order Assigned to Courier',
      message: `Your medicine order #${order.orderNumber} was assigned to courier ${partner.fullName}.`,
      link: `/patient/orders/${order._id}`,
      data: { orderId: order._id, orderNumber: order.orderNumber }
    });

    res.status(200).json({
      success: true,
      message: 'Order assigned to shipping partner successfully.',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reconcile and auto-route any unassigned or pending orders to nearest shipping partners
 * POST /api/v1/shipping/orders/reconcile
 * Access: Shipping Partner or Admin
 */
const reconcileOrders = async (req, res, next) => {
  try {
    const result = await reconcileUnassignedOrders();
    res.status(200).json({
      success: true,
      message: `Logistics reconciliation complete. ${result.routedCount} orders offered.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
