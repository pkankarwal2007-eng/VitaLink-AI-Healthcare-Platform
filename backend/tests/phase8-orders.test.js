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
const { ROLES, ORDER_STATUS, APPOINTMENT_TYPES, APPOINTMENT_STATUS } = require('../config/constants');
const { generateToken } = require('../utils/jwt');

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
      res.on('data', (chunk) => { body += chunk; });
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

const runPhase8Tests = async () => {
  console.log('====================================================');
  console.log('   VitaLink Phase 8 Medicine Orders & Shipping      ');
  console.log('            Delivery Workflows Test Suite           ');
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 1) {
    console.log('[Test Runner] Connecting to MongoDB Atlas...');
    await connectDB();
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
  console.log(`[Test Runner] Test server listening on port ${testPort}`);

  const ts = Date.now();
  const docEmail = `phase8.dr.${ts}@example.com`;
  const pat1Email = `phase8.pat1.${ts}@example.com`;
  const pat2Email = `phase8.pat2.${ts}@example.com`;
  const ship1Email = `phase8.ship1.${ts}@example.com`;
  const ship2Email = `phase8.ship2.${ts}@example.com`;
  const adminEmail = `phase8.admin.${ts}@example.com`;

  let doctorUser, doctorToken;
  let patient1, patient1Token;
  let patient2, patient2Token;
  let shippingUser1, shipping1Token;
  let shippingUser2, shipping2Token;
  let adminUser, adminToken;

  let testAppointment, testPrescription;
  let order1Id;
  let order2Id;

  try {
    // ----------------------------------------------------
    // SETUP: Users, Consultation & Prescription
    // ----------------------------------------------------
    console.log('\n--- 1. Setting Up Clinical Fixtures & Roles ---');

    doctorUser = await User.create({
      fullName: 'Dr. Siddharth Kapoor',
      email: docEmail,
      phone: `987${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.DOCTOR,
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true
    });
    doctorToken = generateToken(doctorUser);

    patient1 = await User.create({
      fullName: 'Ananya Deshmukh',
      email: pat1Email,
      phone: `986${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.PATIENT,
      city: 'Mumbai',
      state: 'Maharashtra',
      address: 'Flat 402, Green Meadows',
      pinCode: '400001',
      isActive: true
    });
    patient1Token = generateToken(patient1);

    patient2 = await User.create({
      fullName: 'Karan Patel',
      email: pat2Email,
      phone: `985${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.PATIENT,
      city: 'Pune',
      state: 'Maharashtra',
      isActive: true
    });
    patient2Token = generateToken(patient2);

    shippingUser1 = await User.create({
      fullName: 'Express Courier Partner 1',
      email: ship1Email,
      phone: `984${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.SHIPPING,
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true
    });
    shipping1Token = generateToken(shippingUser1);

    shippingUser2 = await User.create({
      fullName: 'Swift Logistics Partner 2',
      email: ship2Email,
      phone: `983${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.SHIPPING,
      city: 'Mumbai',
      state: 'Maharashtra',
      isActive: true
    });
    shipping2Token = generateToken(shippingUser2);

    adminUser = await User.create({
      fullName: 'System Logistics Admin',
      email: adminEmail,
      phone: `982${ts.toString().slice(-7)}`,
      password: 'HashedPassword123!',
      role: ROLES.ADMIN,
      isActive: true
    });
    adminToken = generateToken(adminUser);

    // Create completed appointment
    testAppointment = await Appointment.create({
      patient: patient1._id,
      doctor: doctorUser._id,
      date: new Date(),
      timeSlot: { start: '11:00 AM', end: '11:30 AM' },
      consultationType: APPOINTMENT_TYPES.VIDEO,
      status: APPOINTMENT_STATUS.COMPLETED,
      reason: 'Hypertension and seasonal allergies',
      fee: 600
    });

    // Create prescription with medication items
    testPrescription = await Prescription.create({
      patient: patient1._id,
      doctor: doctorUser._id,
      appointment: testAppointment._id,
      clinicalAssessment: 'Essential Hypertension Stage 1 and Allergic Rhinitis',
      medications: [
        {
          name: 'Telmisartan 40mg',
          dosage: '40mg',
          frequency: '1-0-0',
          duration: '30 days',
          instructions: 'Take in morning before breakfast',
          price: 120
        },
        {
          name: 'Cetirizine 10mg',
          dosage: '10mg',
          frequency: '0-0-1',
          duration: '10 days',
          instructions: 'Take at bedtime',
          price: 35
        }
      ],
      testsRecommended: ['Lipid Profile', 'Serum Creatinine'],
      advice: 'Reduce sodium intake. Daily 30-minute brisk walk.',
      followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });

    assert(!!testPrescription._id, 'Clinical test appointment and prescription created successfully');

    // ----------------------------------------------------
    // TEST 1: Patient Places Medicine Order from Prescription
    // ----------------------------------------------------
    console.log('\n--- 2. Prescription Medicine Order Placement ---');

    const orderPayload = {
      prescriptionId: testPrescription._id.toString(),
      deliveryAddress: {
        fullName: 'Ananya Deshmukh',
        phone: '9861112233',
        street: 'Flat 402, Green Meadows, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400050'
      },
      paymentMethod: 'cod',
      notes: 'Please ring bell twice.'
    };

    const placeOrderRes = await request(
      server,
      'POST',
      '/api/v1/orders',
      orderPayload,
      patient1Token
    );

    assert(placeOrderRes.status === 201, 'POST /api/v1/orders returns 201 Created');
    assert(placeOrderRes.data?.success === true, 'Order creation indicates success: true');
    assert(!!placeOrderRes.data?.data?.orderNumber, 'Generated unique orderNumber');
    assert(!!placeOrderRes.data?.data?.trackingNumber, 'Generated unique trackingNumber');
    assert(placeOrderRes.data?.data?.items?.length === 2, 'Order contains 2 prescribed medicine items');
    assert(placeOrderRes.data?.data?.subtotal === 155, 'Subtotal correctly calculated (120 + 35 = 155)');
    assert(placeOrderRes.data?.data?.totalAmount === 195, 'Total includes delivery fee (155 + 40 = 195)');
    assert(placeOrderRes.data?.data?.status === ORDER_STATUS.CONFIRMED, 'Order initial status is "confirmed"');
    order1Id = placeOrderRes.data?.data?._id;

    // Verify prescription marked as ordered
    const updatedRx = await Prescription.findById(testPrescription._id);
    assert(updatedRx.orderedForDelivery === true, 'Prescription marked with orderedForDelivery: true');

    // ----------------------------------------------------
    // TEST 2: Order Validation & Access Boundaries
    // ----------------------------------------------------
    console.log('\n--- 3. Validation & Authorization Boundaries ---');

    // Rejects missing prescriptionId
    const badOrder1 = await request(
      server,
      'POST',
      '/api/v1/orders',
      { deliveryAddress: orderPayload.deliveryAddress },
      patient1Token
    );
    assert(badOrder1.status === 400, 'Rejects order without prescriptionId (400 VALIDATION_ERROR)');

    // Rejects incomplete address
    const badOrder2 = await request(
      server,
      'POST',
      '/api/v1/orders',
      {
        prescriptionId: testPrescription._id.toString(),
        deliveryAddress: { fullName: 'A' }
      },
      patient1Token
    );
    assert(badOrder2.status === 400, 'Rejects order with incomplete address (400)');

    // Patient 2 attempts to order from Patient 1's prescription
    const stolenOrder = await request(
      server,
      'POST',
      '/api/v1/orders',
      orderPayload,
      patient2Token
    );
    assert(stolenOrder.status === 403, 'SECURITY: Patient cannot order from another patient’s prescription (403)');

    // Patient 2 attempts to fetch Patient 1's order directly
    const fetchOtherOrder = await request(
      server,
      'GET',
      `/api/v1/orders/${order1Id}`,
      null,
      patient2Token
    );
    assert(fetchOtherOrder.status === 403, 'DATA PRIVACY: Unrelated patient denied access to order details (403)');

    // Shipping partner forbidden from general /orders endpoint
    const shipAccessOrders = await request(
      server,
      'GET',
      '/api/v1/orders',
      null,
      shipping1Token
    );
    assert(shipAccessOrders.status === 403, 'ROLE SEPARATION: Shipping partner forbidden from general /orders (403)');

    // ----------------------------------------------------
    // TEST 3: Order Retrieval & Patient Isolation
    // ----------------------------------------------------
    console.log('\n--- 4. Order Retrieval & Patient Isolation ---');

    const pat1Orders = await request(
      server,
      'GET',
      '/api/v1/orders',
      null,
      patient1Token
    );
    assert(pat1Orders.status === 200, 'Patient 1 fetches their order list (200)');
    assert(
      (pat1Orders.data?.data || []).some(o => o._id === order1Id),
      'Patient 1 sees their placed order'
    );

    const pat2Orders = await request(
      server,
      'GET',
      '/api/v1/orders',
      null,
      patient2Token
    );
    assert(pat2Orders.status === 200, 'Patient 2 fetches their order list (200)');
    assert(
      !(pat2Orders.data?.data || []).some(o => o._id === order1Id),
      'DATA ISOLATION: Patient 2 does NOT see Patient 1’s order'
    );

    // ----------------------------------------------------
    // TEST 4: Shipping Partner Profile & Available Packages
    // ----------------------------------------------------
    console.log('\n--- 5. Shipping Partner Profile & Available Orders ---');

    // Get default shipping profile
    const getProfileRes = await request(
      server,
      'GET',
      '/api/v1/shipping/profile',
      null,
      shipping1Token
    );
    assert(getProfileRes.status === 200, 'Shipping partner can retrieve / create shipping profile');
    assert(getProfileRes.data?.data?.isAvailable === true, 'Shipping profile defaults to available: true');

    // Update shipping profile
    const updateProfileRes = await request(
      server,
      'PUT',
      '/api/v1/shipping/profile',
      {
        companyName: 'VitaLink FastLogistics Mumbai',
        vehicleType: 'van',
        vehicleNumber: 'MH-02-AB-1234',
        serviceCities: ['Mumbai', 'Thane']
      },
      shipping1Token
    );
    assert(updateProfileRes.status === 200, 'PUT /api/v1/shipping/profile updates partner metadata');
    assert(updateProfileRes.data?.data?.vehicleType === 'van', 'Vehicle type saved as "van"');

    // ----------------------------------------------------
    // TEST 5: Complete Delivery Progression Workflow
    // ----------------------------------------------------
    console.log('\n--- 6. Delivery Lifecycle & State Transitions ---');

    // 1. Admin/Pharmacy packs order
    const packRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/pack`,
      null,
      adminToken
    );
    assert(packRes.status === 200, 'Admin marks order as PACKED (200)');
    assert(packRes.data?.data?.status === ORDER_STATUS.PACKED, 'Order status updated to "packed"');

    // 2. Shipping partner checks available orders in Mumbai
    const availRes = await request(
      server,
      'GET',
      '/api/v1/shipping/orders/available',
      null,
      shipping1Token
    );
    assert(availRes.status === 200, 'Shipping partner fetches available orders (200)');
    assert(
      (availRes.data?.data || []).some(o => o._id === order1Id),
      'Packed order appears in partner’s available pickup queue'
    );

    // 3. Shipping partner claims/accepts the order
    const acceptRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/accept`,
      null,
      shipping1Token
    );
    assert(acceptRes.status === 200, 'Shipping partner accepts order (200)');
    assert(acceptRes.data?.data?.status === ORDER_STATUS.ASSIGNED, 'Order status transitioned to "assigned"');
    assert(
      acceptRes.data?.data?.shippingPartner?.toString() === shippingUser1._id.toString(),
      'Order assigned to Shipping Partner 1'
    );

    // 4. Shipping partner 2 attempts to claim already assigned order
    const stealOrder = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/accept`,
      null,
      shipping2Token
    );
    assert(stealOrder.status === 403, 'SECURITY: Another shipping partner cannot claim already assigned order (403)');

    // 5. Invalid Transition Check: Try jumping directly from ASSIGNED to DELIVERED
    const illegalJump = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/status`,
      { status: ORDER_STATUS.DELIVERED },
      shipping1Token
    );
    assert(
      illegalJump.status === 400,
      'VALIDATION: Cannot skip steps directly from "assigned" to "delivered" (400 INVALID_STATUS_TRANSITION)'
    );

    // 6. Valid Transition: Mark PICKED_UP
    const pickupRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/status`,
      { status: ORDER_STATUS.PICKED_UP, note: 'Collected from Central Pharmacy Hub' },
      shipping1Token
    );
    assert(pickupRes.status === 200, 'Status updated to PICKED_UP (200)');
    assert(pickupRes.data?.data?.status === ORDER_STATUS.PICKED_UP, 'Order status is "picked_up"');

    // 7. Valid Transition: Mark OUT_FOR_DELIVERY
    const outForDeliveryRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/status`,
      { status: ORDER_STATUS.OUT_FOR_DELIVERY, note: 'Rider en route to delivery address' },
      shipping1Token
    );
    assert(outForDeliveryRes.status === 200, 'Status updated to OUT_FOR_DELIVERY (200)');
    assert(outForDeliveryRes.data?.data?.status === ORDER_STATUS.OUT_FOR_DELIVERY, 'Order status is "out_for_delivery"');

    // 8. Valid Transition: Mark DELIVERED
    const deliveredRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/status`,
      { status: ORDER_STATUS.DELIVERED, note: 'Handed over to recipient with signature' },
      shipping1Token
    );
    assert(deliveredRes.status === 200, 'Status updated to DELIVERED (200)');
    assert(deliveredRes.data?.data?.status === ORDER_STATUS.DELIVERED, 'Order status is "delivered"');
    assert(deliveredRes.data?.data?.paymentStatus === 'completed', 'Payment status marked as completed');

    // Verify profile counter incremented
    const partner1Profile = await ShippingProfile.findOne({ user: shippingUser1._id });
    assert(partner1Profile?.totalDeliveredCount >= 1, 'Partner totalDeliveredCount incremented');

    // 9. Terminal state check: cannot update a delivered order
    const updateDelivered = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order1Id}/status`,
      { status: ORDER_STATUS.PICKED_UP },
      shipping1Token
    );
    assert(updateDelivered.status === 400, 'TERMINAL GUARD: Delivered order cannot be modified (400)');

    // ----------------------------------------------------
    // TEST 6: Patient Live Delivery Tracking Endpoint
    // ----------------------------------------------------
    console.log('\n--- 7. Patient Live Delivery Tracking ---');

    const trackRes = await request(
      server,
      'GET',
      `/api/v1/orders/${order1Id}/track`,
      null,
      patient1Token
    );
    assert(trackRes.status === 200, 'GET /api/v1/orders/:id/track returns 200');
    assert(trackRes.data?.data?.status === ORDER_STATUS.DELIVERED, 'Tracking shows current status "delivered"');
    assert(trackRes.data?.data?.statusHistory?.length >= 5, 'Status history timeline includes all lifecycle milestones');
    assert(!!trackRes.data?.data?.carrier, 'Tracking includes carrier metadata');

    // ----------------------------------------------------
    // TEST 7: Order Cancellation Flow
    // ----------------------------------------------------
    console.log('\n--- 8. Order Cancellation Flow & Restrictions ---');

    // Create a 2nd order to test cancellation
    const order2Res = await request(
      server,
      'POST',
      '/api/v1/orders',
      orderPayload,
      patient1Token
    );
    order2Id = order2Res.data?.data?._id;
    assert(!!order2Id, 'Second order placed for cancellation testing');

    // Patient cancels the confirmed order
    const cancelRes = await request(
      server,
      'PATCH',
      `/api/v1/orders/${order2Id}/cancel`,
      { reason: 'Customer changed mind' },
      patient1Token
    );
    assert(cancelRes.status === 200, 'Patient cancels confirmed order (200)');
    assert(cancelRes.data?.data?.status === ORDER_STATUS.CANCELLED, 'Status updated to "cancelled"');

    // Cannot cancel already cancelled order
    const doubleCancel = await request(
      server,
      'PATCH',
      `/api/v1/orders/${order2Id}/cancel`,
      { reason: 'Cancel again' },
      patient1Token
    );
    assert(doubleCancel.status === 400, 'Cannot cancel already cancelled order (400)');

    // Cannot cancel already delivered order (Order 1)
    const cancelDelivered = await request(
      server,
      'PATCH',
      `/api/v1/orders/${order1Id}/cancel`,
      { reason: 'Want refund' },
      patient1Token
    );
    assert(cancelDelivered.status === 400, 'Cannot cancel delivered order (400)');

    // ----------------------------------------------------
    // TEST 8: Partner Rejection & Re-Queuing Workflow
    // ----------------------------------------------------
    console.log('\n--- 9. Courier Rejection & Re-Queuing Workflow ---');

    // Create 3rd order, pack it, assign to Shipping Partner 1
    const order3Res = await request(
      server,
      'POST',
      '/api/v1/orders',
      orderPayload,
      patient1Token
    );
    const order3Id = order3Res.data?.data?._id;

    await request(server, 'PATCH', `/api/v1/shipping/orders/${order3Id}/pack`, null, adminToken);
    await request(server, 'PATCH', `/api/v1/shipping/orders/${order3Id}/accept`, null, shipping1Token);

    // Partner 1 rejects assignment
    const rejectRes = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order3Id}/reject`,
      { reason: 'Vehicle flat tire' },
      shipping1Token
    );
    assert(rejectRes.status === 200, 'Courier partner rejects order (200)');
    assert(rejectRes.data?.data?.status === ORDER_STATUS.PACKED, 'Order reverted to "packed" status');
    assert(rejectRes.data?.data?.shippingPartner === null, 'Shipping partner cleared for reassignment');

    // Partner 2 can now claim it
    const partner2Claim = await request(
      server,
      'PATCH',
      `/api/v1/shipping/orders/${order3Id}/accept`,
      null,
      shipping2Token
    );
    assert(partner2Claim.status === 200, 'Partner 2 successfully re-claims the unassigned order');
    assert(
      partner2Claim.data?.data?.shippingPartner?.toString() === shippingUser2._id.toString(),
      'Order successfully assigned to Partner 2'
    );

    // ----------------------------------------------------
    // TEST 9: Privacy & Secret Redaction
    // ----------------------------------------------------
    console.log('\n--- 10. Data Privacy & Secrets Redaction ---');

    // Check shipping partner assigned orders view
    const partnerOrdersView = await request(
      server,
      'GET',
      '/api/v1/shipping/orders',
      null,
      shipping2Token
    );
    assert(partnerOrdersView.status === 200, 'Shipping partner views assigned orders');

    const strPartnerOrders = JSON.stringify(partnerOrdersView.data);
    assert(
      !strPartnerOrders.includes('Essential Hypertension'),
      'DATA PRIVACY: Shipping partner order view DOES NOT leak clinical diagnosis'
    );
    assert(
      !strPartnerOrders.includes('Reduce sodium intake'),
      'DATA PRIVACY: Shipping partner order view DOES NOT leak doctor clinical advice'
    );
    assert(
      !strPartnerOrders.includes('password') && !strPartnerOrders.includes('HashedPassword'),
      'SECURITY: Responses contain no passwords or secrets'
    );

    // Clean up order 3
    await MedicineOrder.deleteOne({ _id: order3Id });

  } catch (err) {
    console.error('[Phase 8 Test Error]', err);
    failed++;
  } finally {
    console.log('\n--- Cleaning up test fixtures ---');
    try {
      if (doctorUser?._id) await User.deleteOne({ _id: doctorUser._id });
      if (patient1?._id) await User.deleteOne({ _id: patient1._id });
      if (patient2?._id) await User.deleteOne({ _id: patient2._id });
      if (shippingUser1?._id) await User.deleteOne({ _id: shippingUser1._id });
      if (shippingUser2?._id) await User.deleteOne({ _id: shippingUser2._id });
      if (adminUser?._id) await User.deleteOne({ _id: adminUser._id });
      if (testAppointment?._id) await Appointment.deleteOne({ _id: testAppointment._id });
      if (testPrescription?._id) await Prescription.deleteOne({ _id: testPrescription._id });
      if (order1Id) await MedicineOrder.deleteOne({ _id: order1Id });
      if (order2Id) await MedicineOrder.deleteOne({ _id: order2Id });
      await ShippingProfile.deleteMany({
        user: { $in: [shippingUser1?._id, shippingUser2?._id].filter(Boolean) }
      });
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();
    await disconnectDB();

    console.log('\n====================================================');
    console.log(`Phase 8 Tests Complete: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runPhase8Tests();
