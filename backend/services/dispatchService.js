const mongoose = require('mongoose');
const User = require('../models/User');
const ShippingProfile = require('../models/ShippingProfile');
const MedicineOrder = require('../models/MedicineOrder');
const ShippingAssignment = require('../models/ShippingAssignment');
const { ROLES, ORDER_STATUS } = require('../config/constants');
const { getIO } = require('./socketService');
const { createNotification } = require('./notificationService');

/**
 * Normalize text for case and whitespace insensitive matching
 */
const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Standardize 6-digit PIN code format
 */
const normalizePin = (pin) => {
  if (!pin) return '';
  const digits = String(pin).replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : digits;
};

/**
 * Calculate Haversine geographic distance in kilometers
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's mean radius in km
  const toRad = (angle) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
};

/**
 * Find and rank eligible shipping partners by geographic proximity to delivery address
 */
const findEligiblePartners = async (deliveryAddress, excludedPartnerIds = []) => {
  if (!deliveryAddress) return [];

  const targetCity = normalizeText(deliveryAddress.city);
  const targetState = normalizeText(deliveryAddress.state);
  const targetPin = normalizePin(deliveryAddress.pinCode);
  const targetLat = Number(deliveryAddress.latitude);
  const targetLon = Number(deliveryAddress.longitude);
  const hasTargetCoords = !isNaN(targetLat) && !isNaN(targetLon) && targetLat !== 0;

  const excludedStrings = (excludedPartnerIds || []).map((id) => id.toString());

  // 1. Fetch all active shipping users
  const shippingUsers = await User.find({
    role: ROLES.SHIPPING,
    isActive: true
  }).lean();

  if (!shippingUsers.length) return [];

  // Filter out excluded partners
  const availableUsers = shippingUsers.filter(
    (u) => !excludedStrings.includes(u._id.toString())
  );

  if (!availableUsers.length) return [];

  const userIds = availableUsers.map((u) => u._id);

  // 2. Fetch shipping profiles for these users
  const profiles = await ShippingProfile.find({
    user: { $in: userIds }
  }).lean();

  const profileMap = new Map();
  profiles.forEach((p) => {
    profileMap.set(p.user.toString(), p);
  });

  const rankedCandidates = [];

  for (const user of availableUsers) {
    const profile = profileMap.get(user._id.toString()) || {};

    // Check availability
    const isAvailable = profile.isAvailable !== false;
    if (!isAvailable) continue;

    // Check capacity
    const maxCapacity = profile.maxActiveCapacity || 10;
    const activeCount = profile.activeOrdersCount || 0;
    if (activeCount >= maxCapacity) continue;

    // Determine location proximity tier and distance
    let matchTier = 5; // 1: Coords, 2: PIN, 3: City, 4: State, 5: Network Fallback
    let distanceKm = 50.0;
    let matchType = 'fallback';

    // Tier 1: Real Coordinates
    const partnerLat = Number(profile.latitude);
    const partnerLon = Number(profile.longitude);
    const hasPartnerCoords = !isNaN(partnerLat) && !isNaN(partnerLon) && partnerLat !== 0;

    if (hasTargetCoords && hasPartnerCoords) {
      distanceKm = calculateHaversineDistance(targetLat, targetLon, partnerLat, partnerLon);
      matchTier = 1;
      matchType = 'coordinates';
    } else {
      // Tier 2: PIN Code Match
      const profilePins = (profile.servicePincodes || []).map(normalizePin);
      const userPin = normalizePin(profile.pinCode || user.pinCode);
      const pinMatches = targetPin && (profilePins.includes(targetPin) || userPin === targetPin);

      if (pinMatches) {
        matchTier = 2;
        distanceKm = 2.5; // Hyperlocal default
        matchType = 'pincode';
      } else {
        // Tier 3: City Match
        const profileCities = (profile.serviceCities || []).map(normalizeText).filter(Boolean);
        const userCity = normalizeText(profile.city || user.city);
        const cityMatches =
          Boolean(targetCity) &&
          (profileCities.some((c) => c === targetCity || targetCity.includes(c) || c.includes(targetCity)) ||
            (Boolean(userCity) && (userCity === targetCity || targetCity.includes(userCity) || userCity.includes(targetCity))));

        if (cityMatches) {
          matchTier = 3;
          distanceKm = 10.0; // Citywide default
          matchType = 'city';
        } else {
          // Tier 4: State Match
          const userState = normalizeText(profile.state || user.state);
          const stateMatches =
            Boolean(targetState) &&
            Boolean(userState) &&
            (userState === targetState || targetState.includes(userState) || userState.includes(targetState));

          if (stateMatches) {
            matchTier = 4;
            distanceKm = 45.0; // Regional default
            matchType = 'state';
          } else {
            // Tier 5: Fallback partner in network
            matchTier = 5;
            distanceKm = 95.0;
            matchType = 'fallback';
          }
        }
      }
    }

    rankedCandidates.push({
      user,
      profile,
      matchTier,
      distanceKm,
      matchType,
      activeOrdersCount: activeCount,
      rating: profile.rating || 5.0
    });
  }

  // 3. Sort candidates:
  // Primary: Match Tier (1 is best, 5 is fallback)
  // Secondary: Distance ascending
  // Tertiary: Workload ascending (least loaded)
  // Quaternary: Rating descending
  rankedCandidates.sort((a, b) => {
    if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    if (a.activeOrdersCount !== b.activeOrdersCount) return a.activeOrdersCount - b.activeOrdersCount;
    return b.rating - a.rating;
  });

  return rankedCandidates;
};

/**
 * Automatically route a medicine order to the nearest eligible shipping partner
 */
const routeOrderToNearestPartner = async (orderOrId) => {
  let order = orderOrId;
  if (typeof orderOrId === 'string' || orderOrId instanceof mongoose.Types.ObjectId) {
    order = await MedicineOrder.findById(orderOrId);
  }

  if (!order) {
    return { success: false, reason: 'ORDER_NOT_FOUND' };
  }

  // If already accepted or terminal
  if (order.shippingPartner && [ORDER_STATUS.ASSIGNED, ORDER_STATUS.PICKED_UP, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED].includes(order.status)) {
    return { success: false, reason: 'ORDER_ALREADY_ASSIGNED' };
  }

  const excluded = (order.rejectedPartners || []).map((r) => r.partner.toString());
  const candidates = await findEligiblePartners(order.deliveryAddress, excluded);

  if (!candidates.length) {
    order.dispatchStatus = 'unassigned';
    order.offeredTo = null;
    order.offerExpiresAt = null;
    await order.save();
    return { success: false, reason: 'NO_ELIGIBLE_PARTNER' };
  }

  const topCandidate = candidates[0];
  const partnerId = topCandidate.user._id;

  // 1. Create or update ShippingAssignment with status 'offered'
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute offer expiry

  const assignment = await ShippingAssignment.create({
    order: order._id,
    shippingPartner: partnerId,
    shippingProfile: topCandidate.profile?._id,
    distanceKm: topCandidate.distanceKm,
    matchType: topCandidate.matchType,
    status: 'offered',
    offeredAt: new Date(),
    expiresAt
  });

  // 2. Update order with candidate offer
  order.offeredTo = partnerId;
  order.offerExpiresAt = expiresAt;
  order.activeAssignment = assignment._id;
  order.dispatchStatus = 'offered';
  await order.save();

  // 3. Real-time Socket.IO notification to candidate courier partner
  const io = getIO();
  if (io) {
    io.to(`user:${partnerId.toString()}`).emit('new-shipping-offer', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      deliveryCity: order.deliveryAddress?.city,
      distanceKm: topCandidate.distanceKm,
      matchType: topCandidate.matchType,
      expiresAt
    });
  }

  // 4. Persistence Notification
  await createNotification({
    recipient: partnerId,
    sender: null,
    type: 'order_update',
    title: 'New Delivery Offer Available',
    message: `Prescription order #${order.orderNumber} in ${order.deliveryAddress?.city} is available for pickup (${topCandidate.distanceKm} km away).`,
    link: '/shipping/orders',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      assignmentId: assignment._id,
      distanceKm: topCandidate.distanceKm
    }
  });

  return {
    success: true,
    partner: topCandidate.user,
    assignment,
    distanceKm: topCandidate.distanceKm,
    matchType: topCandidate.matchType
  };
};

/**
 * Handle partner rejection and immediately trigger fallback routing to next-nearest candidate
 */
const handlePartnerRejection = async (orderId, partnerId, reason = 'Courier partner unavailable') => {
  const order = await MedicineOrder.findById(orderId);
  if (!order) {
    return { success: false, reason: 'ORDER_NOT_FOUND' };
  }

  // Update existing assignment to rejected
  await ShippingAssignment.updateMany(
    { order: order._id, shippingPartner: partnerId, status: { $in: ['offered', 'accepted'] } },
    { $set: { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason.trim() } }
  );

  // Record rejection on order
  order.rejectedPartners.push({
    partner: partnerId,
    rejectedAt: new Date(),
    reason: reason.trim()
  });

  // Clear current offer/assignment on order
  order.offeredTo = null;
  order.offerExpiresAt = null;
  order.shippingPartner = null;
  order.shippingProfile = null;
  order.activeAssignment = null;
  order.dispatchStatus = 'unassigned';
  const wasPacked = Boolean(order.packedAt) || (order.statusHistory && order.statusHistory.some(h => h.status === ORDER_STATUS.PACKED));
  if (order.status === ORDER_STATUS.ASSIGNED) {
    order.status = wasPacked ? ORDER_STATUS.PACKED : ORDER_STATUS.CONFIRMED;
  }
  await order.save();

  // Decrement partner's active order count if they had claimed it
  await ShippingProfile.findOneAndUpdate(
    { user: partnerId, activeOrdersCount: { $gt: 0 } },
    { $inc: { activeOrdersCount: -1 } }
  );

  // Immediately route to the next nearest eligible shipping partner!
  const fallbackResult = await routeOrderToNearestPartner(order);

  return {
    success: true,
    rejectedPartner: partnerId,
    order,
    fallbackResult
  };
};

/**
 * Scan database for unassigned orders (including legacy orders) and route them
 */
const reconcileUnassignedOrders = async () => {
  const now = new Date();

  const unassignedOrders = await MedicineOrder.find({
    status: { $in: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKED] },
    shippingPartner: null,
    $or: [
      { offeredTo: null },
      { offerExpiresAt: { $lt: now } },
      { dispatchStatus: 'unassigned' }
    ]
  });

  let routedCount = 0;
  for (const order of unassignedOrders) {
    const res = await routeOrderToNearestPartner(order);
    if (res.success) routedCount++;
  }

  return {
    totalScanned: unassignedOrders.length,
    routedCount
  };
};

module.exports = {
  normalizeText,
  normalizePin,
  calculateHaversineDistance,
  findEligiblePartners,
  routeOrderToNearestPartner,
  handlePartnerRejection,
  reconcileUnassignedOrders
};
