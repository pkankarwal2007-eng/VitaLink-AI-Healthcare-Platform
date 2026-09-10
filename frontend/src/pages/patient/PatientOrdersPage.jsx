import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShoppingBag,
  ExternalLink,
  MapPin,
  Phone,
  User,
  Pill,
  ChevronRight,
  X
} from 'lucide-react';

export const PatientOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Tracking modal
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // New Order modal
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [selectedRxId, setSelectedRxId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    street: user?.address || '',
    city: user?.city || 'Mumbai',
    state: user?.state || 'Maharashtra',
    pinCode: user?.pinCode || ''
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [orderNotes, setOrderNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Cancel order modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchOrdersAndPrescriptions();
  }, []);

  const fetchOrdersAndPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const [orderRes, rxRes] = await Promise.all([
        apiClient.get('/orders'),
        apiClient.get('/medical/prescriptions')
      ]);

      if (orderRes.data?.success) {
        setOrders(orderRes.data.data || []);
      }
      if (rxRes.data?.success) {
        setPrescriptions(rxRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError(err.response?.data?.message || 'Failed to load medicine orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTracking = async (orderId) => {
    try {
      setTrackingLoading(true);
      setTrackingModalOpen(true);
      const res = await apiClient.get(`/orders/${orderId}/track`);
      if (res.data?.success) {
        setSelectedTracking(res.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load live tracking details.');
      setTrackingModalOpen(false);
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleOpenNewOrder = (preselectedRx = null) => {
    if (preselectedRx) {
      setSelectedRxId(preselectedRx._id);
    } else if (prescriptions.length > 0) {
      setSelectedRxId(prescriptions[0]._id);
    }
    setDeliveryAddress({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      street: user?.address || '',
      city: user?.city || 'Mumbai',
      state: user?.state || 'Maharashtra',
      pinCode: user?.pinCode || ''
    });
    setOrderError(null);
    setNewOrderModalOpen(true);
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRxId) {
      setOrderError('Please select a valid doctor prescription.');
      return;
    }

    try {
      setSubmittingOrder(true);
      setOrderError(null);

      const payload = {
        prescriptionId: selectedRxId,
        deliveryAddress,
        paymentMethod,
        notes: orderNotes
      };

      const res = await apiClient.post('/orders', payload);
      if (res.data?.success) {
        setSuccessMsg(`Order ${res.data.data.orderNumber} placed successfully! Tracking #: ${res.data.data.trackingNumber}`);
        setNewOrderModalOpen(false);
        fetchOrdersAndPrescriptions();
        setTimeout(() => setSuccessMsg(null), 6000);
      }
    } catch (err) {
      console.error('Failed to place order:', err);
      setOrderError(err.response?.data?.message || 'Failed to place medicine order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleCancelOrder = async (e) => {
    e.preventDefault();
    try {
      setCancelling(true);
      const res = await apiClient.patch(`/orders/${cancellingOrderId}/cancel`, {
        reason: cancelReason || 'Cancelled by patient'
      });
      if (res.data?.success) {
        setSuccessMsg('Order cancelled successfully.');
        setCancelModalOpen(false);
        fetchOrdersAndPrescriptions();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Pending</span>;
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Confirmed</span>;
      case 'packed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Packed</span>;
      case 'assigned':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Assigned</span>;
      case 'picked_up':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">Picked Up</span>;
      case 'out_for_delivery':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
            Out for Delivery
          </span>
        );
      case 'delivered':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Delivered</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'all') return true;
    return o.status === filterStatus;
  });

  const selectedPrescriptionObj = prescriptions.find(p => p._id === selectedRxId);

  return (
    <DashboardLayout title="Medicine Orders & Delivery">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-600" />
              <span>Prescription Medicine Orders & Delivery</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Order verified medications directly from your prescriptions with real-time courier tracking.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchOrdersAndPrescriptions}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-xs transition"
            >
              Refresh
            </button>
            <button
              onClick={() => handleOpenNewOrder()}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              Order from Prescription
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-200 space-x-2">
          {[
            { key: 'all', label: `All Orders (${orders.length})` },
            { key: 'confirmed', label: `Confirmed (${orders.filter(o => o.status === 'confirmed').length})` },
            { key: 'out_for_delivery', label: `In Transit (${orders.filter(o => ['packed', 'assigned', 'picked_up', 'out_for_delivery'].includes(o.status)).length})` },
            { key: 'delivered', label: `Delivered (${orders.filter(o => o.status === 'delivered').length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                filterStatus === tab.key
                  ? 'border-teal-600 text-teal-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-40 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Package className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No medicine orders found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              You can order medicines prescribed by your doctor with home delivery and live tracking.
            </p>
            <button
              onClick={() => handleOpenNewOrder()}
              className="mt-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition shadow-xs"
            >
              Place Your First Order
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 hover:border-teal-300 transition flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                      {order.orderNumber}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Track: {order.trackingNumber}
                    </span>
                    {getStatusBadge(order.status)}
                    <span className="text-[11px] text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Items summary */}
                  <div className="text-xs text-slate-700">
                    <span className="font-bold text-slate-900">{order.items?.length || 0} Medications: </span>
                    <span className="text-slate-600">
                      {order.items?.map(i => `${i.name} (${i.dosage})`).join(', ')}
                    </span>
                  </div>

                  {/* Delivery destination */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Delivering to: {order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.pinCode}</span>
                  </div>

                  {/* Pricing and Courier partner */}
                  <div className="flex items-center gap-4 text-xs pt-1 flex-wrap">
                    <span className="font-bold text-slate-900">
                      Total: ₹{order.totalAmount} <span className="text-[10px] font-normal text-slate-500">({order.paymentMethod?.toUpperCase()})</span>
                    </span>
                    {order.shippingPartner && (
                      <span className="text-slate-600 flex items-center gap-1 text-[11px]">
                        <Truck className="w-3 h-3 text-teal-600" />
                        Courier: <span className="font-semibold text-slate-800">{order.shippingPartner?.fullName}</span>
                      </span>
                    )}
                    {order.estimatedDelivery && (
                      <span className="text-sky-700 text-[11px]">
                        Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    onClick={() => handleOpenTracking(order._id)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Live Tracking
                  </button>

                  {['pending', 'confirmed'].includes(order.status) && (
                    <button
                      onClick={() => {
                        setCancellingOrderId(order._id);
                        setCancelReason('');
                        setCancelModalOpen(true);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-semibold transition"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live Tracking Modal */}
        {trackingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Live Delivery Tracking
                  </h3>
                </div>
                <button
                  onClick={() => setTrackingModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {trackingLoading ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Loading tracking details...
                </div>
              ) : selectedTracking ? (
                <div className="mt-4 space-y-6">
                  {/* Order Overview Header */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{selectedTracking.orderNumber}</span>
                      {getStatusBadge(selectedTracking.status)}
                    </div>
                    <div className="text-slate-600">
                      <span className="font-semibold">Tracking #: </span>
                      <span className="font-mono">{selectedTracking.trackingNumber}</span>
                    </div>
                    <div className="text-slate-600">
                      <span className="font-semibold">Courier Partner: </span>
                      <span>
                        {selectedTracking.carrier} ({selectedTracking.vehicleType})
                        {selectedTracking.carrierPhone ? ` • Contact: ${selectedTracking.carrierPhone}` : ''}
                      </span>
                    </div>
                    {selectedTracking.estimatedDelivery && (
                      <div className="text-teal-700 font-semibold">
                        Expected Delivery by: {new Date(selectedTracking.estimatedDelivery).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                      Shipment Progression Timeline
                    </h4>

                    <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200">
                      {selectedTracking.statusHistory?.map((step, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-teal-600 border-2 border-white shadow-xs"></div>
                          <div className="text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 uppercase text-[11px]">
                                {step.status?.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(step.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            {step.note && (
                              <p className="text-slate-600 mt-0.5 text-xs">{step.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setTrackingModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Place New Order Modal */}
        {newOrderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-teal-600" />
                  Order Prescribed Medications
                </h3>
                <button
                  onClick={() => setNewOrderModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrderSubmit} className="mt-6 space-y-6">
                {/* Select Prescription */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Select Valid Doctor Prescription *
                  </label>
                  {prescriptions.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      No prescriptions found on record. A verified doctor consultation is required before ordering medicines.
                    </p>
                  ) : (
                    <select
                      value={selectedRxId}
                      onChange={(e) => setSelectedRxId(e.target.value)}
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                      required
                    >
                      {prescriptions.map(rx => (
                        <option key={rx._id} value={rx._id}>
                          Dr. {rx.doctor?.fullName} — {rx.clinicalAssessment} ({new Date(rx.createdAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Medication Items Preview */}
                {selectedPrescriptionObj && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Medications Included in this Order
                    </h4>
                    <div className="divide-y divide-slate-200">
                      {selectedPrescriptionObj.medications?.map((m, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">{m.name}</span>
                            <span className="text-slate-500 ml-2">({m.dosage}) • {m.frequency}</span>
                          </div>
                          <span className="font-semibold text-slate-800">₹{m.price || 50}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-slate-500">Delivery Fee (Express Couriers):</span>
                      <span className="font-semibold text-slate-800">₹40</span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                      <span>Total Amount Payable:</span>
                      <span className="text-teal-700">
                        ₹{(selectedPrescriptionObj.medications?.reduce((sum, m) => sum + (m.price || 50), 0) || 0) + 40}
                      </span>
                    </div>
                  </div>
                )}

                {/* Delivery Address */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Shipping & Delivery Address *
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Recipient Name</span>
                      <input
                        type="text"
                        value={deliveryAddress.fullName}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, fullName: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Contact Phone</span>
                      <input
                        type="text"
                        value={deliveryAddress.phone}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Street Address / House No.</span>
                    <input
                      type="text"
                      value={deliveryAddress.street}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">City</span>
                      <input
                        type="text"
                        value={deliveryAddress.city}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">State</span>
                      <input
                        type="text"
                        value={deliveryAddress.state}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, state: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">PIN Code</span>
                      <input
                        type="text"
                        value={deliveryAddress.pinCode}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, pinCode: e.target.value })}
                        className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Option */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                    Payment Mode
                  </h4>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="text-teal-600"
                      />
                      Cash on Delivery (COD)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="upi"
                        checked={paymentMethod === 'upi'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="text-teal-600"
                      />
                      Online UPI / Card
                    </label>
                  </div>
                </div>

                {orderError && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{orderError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setNewOrderModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 hover:bg-slate-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrder || prescriptions.length === 0}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingOrder && (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    Confirm & Place Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  Cancel Medicine Order
                </h3>
                <button onClick={() => setCancelModalOpen(false)} className="text-slate-400 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCancelOrder} className="mt-4 space-y-4">
                <p className="text-xs text-slate-600">
                  Are you sure you want to cancel this order? This action cannot be undone.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Reason for cancellation
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Purchased locally, ordered by mistake"
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setCancelModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    disabled={cancelling}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientOrdersPage;
