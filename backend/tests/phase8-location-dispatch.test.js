const path = require('path');
const dotenv = require('dotenv');

// Load root .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicineOrder = require('../models/MedicineOrder');
const ShippingProfile = require('../models/ShippingProfile');
const ShippingAssignment = require('../models/ShippingAssignment');
const Notification = require('../models/Notification');
const { ROLES, ORDER_STATUS, APPOINTMENT_TYPES, APPOINTMENT_STATUS } = require('../config/constants');
const { generateToken } = require('../utils/jwt');
const { reconcileUnassignedOrders } = require('../services/dispatchService');

// Helper for JSON HTTP requests
const request = (server, method, reqPath, data = null, token = null) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runLocationDispatchTests = async () => {
  console.log('====================================================');
  console.log('  VitaLink Phase 8 Location-Based Logistics &       ');
  console.log('    Nearest Partner Dispatch Automated Test Suite   ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
    console.log('[Test Runner] Connecting to MongoDB Atlas...');
    await connectDB();
  }

  // Purge any lingering example.com test accounts before running to guarantee pristine isolation
  const lingeringTestUsers = await User.find({ email: /@example\.com$/ });
  if (lingeringTestUsers.length > 0) {
    const lingeringIds = lingeringTestUsers.map((u) => u._id);
    await ShippingProfile.deleteMany({ user: { $in: lingeringIds } });
    await ShippingAssignment.deleteMany({ shippingPartner: { $in: lingeringIds } });
    await MedicineOrder.deleteMany({ patient: { $in: lingeringIds } });
    await User.deleteMany({ _id: { $in: lingeringIds } });
  }

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const testPort = server.address().port;
  console.log(`[Test Runner] Active test server on port ${testPort}`);

  const ts = Date.now();
  let partnerDelhi, partnerJalandhar, partnerLudhiana;
  let doctorUser, patientPunjab, appointment, prescription, orderId;

  try {
    // ----------------------------------------------------
    // Section 1: Create Multi-City Shipping Partners
    // Partner Delhi, Partner Jalandhar, Partner Ludhiana
    // ----------------------------------------------------
    console.log('\n--- 1. Setting Up Multi-City Shipping Partners & Profiles ---');

    partnerDelhi = await User.create({
      fullName: 'Delhi Express Logistics',
      email: `delhi.ship.${ts}@example.com`,
      phone: `980${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.SHIPPING,
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      isActive: true
    });
    const tokenDelhi = generateToken(partnerDelhi);
    await ShippingProfile.create({
      user: partnerDelhi._id,
      companyName: 'Delhi Express Couriers',
      city: 'Delhi',
      state: 'Delhi',
      pinCode: '110001',
      serviceCities: ['Delhi', 'New Delhi'],
      servicePincodes: ['110001', '110002'],
      isAvailable: true,
      activeOrdersCount: 0
    });

    partnerJalandhar = await User.create({
      fullName: 'Jalandhar FastTrack Couriers',
      email: `jal.ship.${ts}@example.com`,
      phone: `981${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.SHIPPING,
      city: 'Jalandhar',
      state: 'Punjab',
      pinCode: '144001',
      isActive: true
    });
    const tokenJalandhar = generateToken(partnerJalandhar);
    await ShippingProfile.create({
      user: partnerJalandhar._id,
      companyName: 'Jalandhar FastTrack Hub',
      city: 'Jalandhar',
      state: 'Punjab',
      pinCode: '144001',
      serviceCities: ['Jalandhar'],
      servicePincodes: ['144001', '144002'],
      isAvailable: true,
      activeOrdersCount: 0
    });

    partnerLudhiana = await User.create({
      fullName: 'Ludhiana Cargo Express',
      email: `ludh.ship.${ts}@example.com`,
      phone: `982${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.SHIPPING,
      city: 'Ludhiana',
      state: 'Punjab',
      pinCode: '141001',
      isActive: true
    });
    const tokenLudhiana = generateToken(partnerLudhiana);
    await ShippingProfile.create({
      user: partnerLudhiana._id,
      companyName: 'Ludhiana Cargo Hub',
      city: 'Ludhiana',
      state: 'Punjab',
      pinCode: '141001',
      serviceCities: ['Ludhiana'],
      servicePincodes: ['141001'],
      isAvailable: true,
      activeOrdersCount: 0
    });

    assert(true, 'Created 3 shipping partners across Delhi, Jalandhar, and Ludhiana');

    // ----------------------------------------------------
    // Section 2: Patient Places Medicine Order in Jalandhar
    // ----------------------------------------------------
    console.log('\n--- 2. Prescription Order Placement & Nearest Partner Proximity Matching ---');

    doctorUser = await User.create({
      fullName: 'Dr. Jaspreet Singh',
      email: `dr.jas.${ts}@example.com`,
      phone: `983${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.DOCTOR,
      city: 'Jalandhar',
      state: 'Punjab',
      isActive: true
    });

    patientPunjab = await User.create({
      fullName: 'Harpreet Kaur',
      email: `harpreet.${ts}@example.com`,
      phone: `984${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.PATIENT,
      city: 'Jalandhar',
      state: 'Punjab',
      pinCode: '144001',
      isActive: true
    });
    const tokenPatient = generateToken(patientPunjab);

    appointment = await Appointment.create({
      patient: patientPunjab._id,
      doctor: doctorUser._id,
      date: new Date(),
      timeSlot: { start: '10:00 AM', end: '10:30 AM' },
      consultationType: APPOINTMENT_TYPES.VIDEO,
      status: APPOINTMENT_STATUS.COMPLETED,
      reason: 'Seasonal asthma consultation',
      fee: 500
    });

    prescription = await Prescription.create({
      patient: patientPunjab._id,
      doctor: doctorUser._id,
      appointment: appointment._id,
      clinicalAssessment: 'Mild intermittent bronchial asthma',
      medications: [
        {
          name: 'Salbutamol Inhaler 100mcg',
          dosage: '100mcg',
          frequency: 'As needed',
          duration: '30 days',
          instructions: '1 puff when breathless',
          price: 180
        }
      ],
      advice: 'Avoid cold exposure and dust.'
    });

    // Patient places order in Jalandhar
    const orderRes = await request(
      server,
      'POST',
      '/api/v1/orders',
      {
        prescriptionId: prescription._id.toString(),
        deliveryAddress: {
          fullName: 'Harpreet Kaur',
          phone: '9841112233',
          street: 'House 45, Model Town',
          city: 'Jalandhar',
          state: 'Punjab',
          pinCode: '144001'
        },
        paymentMethod: 'cod'
      },
      tokenPatient
    );

    assert(orderRes.status === 201, 'POST /api/v1/orders returns 201 Created');
    orderId = orderRes.data?.data?._id;
    assert(!!orderId, 'Order created with unique ID');

    // Verify order was automatically routed to NEAREST partner (Jalandhar, NOT Delhi or Ludhiana)
    const freshOrder = await MedicineOrder.findById(orderId);
    assert(
      freshOrder?.offeredTo?.toString() === partnerJalandhar._id.toString(),
      'NEAREST ROUTING: Order automatically offered to Jalandhar partner (same PIN/city)'
    );
    assert(freshOrder?.dispatchStatus === 'offered', 'Order dispatchStatus transitioned to "offered"');

    // Verify ShippingAssignment created
    const assignment = await ShippingAssignment.findOne({ order: orderId });
    assert(!!assignment, 'ShippingAssignment automatically created');
    assert(assignment?.shippingPartner?.toString() === partnerJalandhar._id.toString(), 'Assignment assigned to Jalandhar partner');
    assert(assignment?.status === 'offered', 'Assignment status is "offered"');
    assert(assignment?.distanceKm != null && assignment?.distanceKm <= 5.0, `Assignment distance calculated (${assignment?.distanceKm} km)`);

    // Verify notification was sent to Jalandhar partner
    const partnerNotif = await Notification.findOne({
      recipient: partnerJalandhar._id,
      type: 'order_update'
    });
    assert(!!partnerNotif, 'Notification dispatched to nearest courier partner');
    assert(partnerNotif?.message?.includes('Jalandhar'), 'Notification mentions delivery city');

    // ----------------------------------------------------
    // Section 3: Partner Queue Visibility & Privacy
    // ----------------------------------------------------
    console.log('\n--- 3. Partner Available Queue & Medical Privacy ---');

    // Jalandhar partner checks available orders
    const jalAvail = await request(server, 'GET', '/api/v1/shipping/orders/available', null, tokenJalandhar);
    assert(jalAvail.status === 200, 'Jalandhar partner retrieves available pickup queue');
    assert(
      (jalAvail.data?.data || []).some((o) => o._id.toString() === orderId.toString()),
      'Jalandhar partner sees the offered package in Available for Pickup'
    );
    const offeredItem = (jalAvail.data?.data || []).find((o) => o._id.toString() === orderId.toString());
    assert(offeredItem?.isDirectOffer === true, 'Offered package flagged with isDirectOffer: true');
    assert(offeredItem?.distanceKm != null, 'Offered package displays distance in km');
    assert(offeredItem?.clinicalAssessment === undefined, 'PRIVACY: Clinical assessment is strictly redacted');
    assert(offeredItem?.doctor === undefined, 'PRIVACY: Doctor diagnosis details are strictly redacted');

    // Delhi partner checks available orders -> Jalandhar order is NOT shown to Delhi
    const delhiAvail = await request(server, 'GET', '/api/v1/shipping/orders/available', null, tokenDelhi);
    assert(
      !(delhiAvail.data?.data || []).some((o) => o._id.toString() === orderId.toString()),
      'DATA ISOLATION: Delhi partner does NOT see package offered to Jalandhar'
    );

    // ----------------------------------------------------
    // Section 4: Fallback Routing on Partner Rejection
    // ----------------------------------------------------
    console.log('\n--- 4. Fallback Re-Routing when Nearest Partner Rejects ---');

    // Jalandhar partner rejects order
    const rejectRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/reject`,
      { reason: 'Vehicle tire puncture' },
      tokenJalandhar
    );
    assert(rejectRes.status === 200, 'Nearest partner rejects order successfully (200 OK)');

    // Verify Jalandhar assignment marked rejected
    const jalAssignment = await ShippingAssignment.findOne({
      order: orderId,
      shippingPartner: partnerJalandhar._id
    });
    assert(jalAssignment?.status === 'rejected', 'Jalandhar assignment status updated to "rejected"');

    // Verify order was re-routed to NEXT-NEAREST partner (Ludhiana, Punjab, NOT Delhi)
    const reroutedOrder = await MedicineOrder.findById(orderId);
    assert(
      reroutedOrder?.offeredTo?.toString() === partnerLudhiana._id.toString(),
      'FALLBACK ENGINE: Order automatically re-routed to next-nearest partner (Ludhiana)'
    );

    // Verify Ludhiana partner now sees the order in available queue
    const ludhAvail = await request(server, 'GET', '/api/v1/shipping/orders/available', null, tokenLudhiana);
    assert(
      (ludhAvail.data?.data || []).some((o) => o._id.toString() === orderId.toString()),
      'Ludhiana partner now sees package in Available for Pickup after nearest partner rejected'
    );

    // ----------------------------------------------------
    // Section 5: Atomic Concurrency & Claim Protection
    // ----------------------------------------------------
    console.log('\n--- 5. Atomic Concurrency & Race Condition Prevention ---');

    // Ludhiana partner claims the order
    const acceptRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/accept`,
      null,
      tokenLudhiana
    );
    assert(acceptRes.status === 200, 'Ludhiana partner successfully claims order (200 OK)');
    assert(acceptRes.data?.data?.status === ORDER_STATUS.ASSIGNED, 'Order transitioned to "assigned"');

    // Delhi partner attempts to steal/claim the already accepted order
    const stealRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/accept`,
      null,
      tokenDelhi
    );
    assert(
      stealRes.status === 409 || stealRes.status === 400 || stealRes.status === 403,
      `CONCURRENCY GUARD: Competing courier claim rejected with ${stealRes.status} (cannot steal active order)`
    );

    // ----------------------------------------------------
    // Section 6: Delivery Progression & Patient Tracking
    // ----------------------------------------------------
    console.log('\n--- 6. Delivery Lifecycle & Patient Tracking ---');

    // Picked Up
    const pickupRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/status`,
      { status: ORDER_STATUS.PICKED_UP },
      tokenLudhiana
    );
    assert(pickupRes.status === 200, 'Package marked as PICKED_UP');

    // Out for Delivery
    const outRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/status`,
      { status: ORDER_STATUS.OUT_FOR_DELIVERY },
      tokenLudhiana
    );
    assert(outRes.status === 200, 'Package marked as OUT_FOR_DELIVERY');

    // Delivered
    const deliveredRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${orderId}/status`,
      { status: ORDER_STATUS.DELIVERED },
      tokenLudhiana
    );
    assert(deliveredRes.status === 200, 'Package marked as DELIVERED');

    // Patient checks tracking
    const trackRes = await request(
      server,
      'GET',
      `/api/v1/orders/${orderId}/track`,
      null,
      tokenPatient
    );
    assert(trackRes.status === 200, 'Patient fetches live delivery tracking');
    assert(trackRes.data?.data?.status === ORDER_STATUS.DELIVERED, 'Tracking reports status "delivered"');
    assert(
      trackRes.data?.data?.carrier?.includes('Ludhiana Cargo'),
      'Tracking reports carrier name without exposing private account info'
    );

    // ----------------------------------------------------
    // Section 7: Existing Order Reconciliation
    // ----------------------------------------------------
    console.log('\n--- 7. Existing Database Order Reconciliation (ORD-736348-8311 in Alwar) ---');

    const reconcileResult = await reconcileUnassignedOrders();
    assert(reconcileResult.totalScanned >= 0, `Reconciliation executed without error (scanned: ${reconcileResult.totalScanned})`);

    // Check existing order in DB
    const existingAlwarOrder = await MedicineOrder.findOne({ orderNumber: 'ORD-736348-8311' });
    if (existingAlwarOrder) {
      assert(
        existingAlwarOrder.offeredTo != null || existingAlwarOrder.shippingPartner != null,
        `EXISTING FIXTURE ACTIVATION: Order ORD-736348-8311 routed (offeredTo: ${existingAlwarOrder.offeredTo || existingAlwarOrder.shippingPartner})`
      );
    }

    console.log('\n====================================================');
    console.log(`  Tests Passed: ${passed} | Tests Failed: ${failed}`);
    console.log('====================================================');
  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (partnerDelhi?._id) await User.deleteOne({ _id: partnerDelhi._id });
      if (partnerJalandhar?._id) await User.deleteOne({ _id: partnerJalandhar._id });
      if (partnerLudhiana?._id) await User.deleteOne({ _id: partnerLudhiana._id });
      if (doctorUser?._id) await User.deleteOne({ _id: doctorUser._id });
      if (patientPunjab?._id) await User.deleteOne({ _id: patientPunjab._id });
      await ShippingProfile.deleteMany({
        user: { $in: [partnerDelhi?._id, partnerJalandhar?._id, partnerLudhiana?._id].filter(Boolean) }
      });
      if (orderId) {
        await MedicineOrder.deleteOne({ _id: orderId });
        await ShippingAssignment.deleteMany({ order: orderId });
      }
      if (appointment?._id) await Appointment.deleteOne({ _id: appointment._id });
      if (prescription?._id) await Prescription.deleteOne({ _id: prescription._id });
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runLocationDispatchTests();
