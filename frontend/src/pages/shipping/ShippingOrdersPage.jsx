import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  Package,
  PackageCheck,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Check,
  X
} from 'lucide-react';

export const ShippingOrdersPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('active'); // active, available, history
  const [orders, setOrders] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectOrderId, setRejectOrderId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'available') {
        const res = await apiClient.get('/shipping/orders/available');
        if (res.data?.success) {
          setAvailableOrders(res.data.data || []);
        }
      } else {
        const statusParam = activeTab === 'active' ? 'active' : 'history';
        const res = await apiClient.get(`/shipping/orders?status=${statusParam}`);
        if (res.data?.success) {
          setOrders(res.data.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to load shipping orders:', err);
      setError(err.response?.data?.message || 'Failed to load dispatch orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      setActionLoadingId(orderId);
      const res = await apiClient.patch(`/shipping/orders/${orderId}/accept`);
      if (res.data?.success) {
        setSuccessMsg('Order accepted and assigned to your route!');
        setActiveTab('active');
        fetchOrders();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept order.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      setActionLoadingId(orderId);
      const res = await apiClient.patch(`/shipping/orders/${orderId}/status`, {
        status: nextStatus
      });
      if (res.data?.success) {
        setSuccessMsg(`Order updated to "${nextStatus.replace('_', ' ')}"!`);
        fetchOrders();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    try {
      setRejecting(true);
      const res = await apiClient.patch(`/shipping/orders/${rejectOrderId}/reject`, {
        reason: rejectReason || 'Partner unavailable'
      });
      if (res.data?.success) {
        setSuccessMsg('Order rejected and re-queued for other couriers.');
        setRejectModalOpen(false);
        fetchOrders();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject order.');
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
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

  return (
    <DashboardLayout title="Dispatch & Delivery Orders">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              <span>Prescription Package Dispatch Queue</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pickup verified medicine packages from pharmacy hubs and fulfill deliveries to patient addresses.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchOrders}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
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
            { key: 'active', label: 'Active Route' },
            { key: 'available', label: 'Available for Pickup' },
            { key: 'history', label: 'Delivered History' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-36 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : activeTab === 'available' ? (
          /* Available for Pickup */
          availableOrders.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-2">
              <Package className="w-10 h-10 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">No packages currently awaiting pickup</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                When the pharmacy packs new prescription orders in your service city, they will appear here ready to claim.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableOrders.map(order => (
                <div
                  key={order._id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {order.orderNumber}
                      </span>
                      {order.isDirectOffer ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <span>⚡ Nearest Partner Dispatch</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Ready for Pickup
                        </span>
                      )}
                      {order.distanceKm != null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {order.distanceKm} km away
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {order.deliveryAddress?.fullName ? `${order.deliveryAddress.fullName} • ` : ''}
                        {order.deliveryAddress?.street ? `${order.deliveryAddress.street}, ` : ''}
                        {order.deliveryAddress?.city}, {order.deliveryAddress?.state} ({order.deliveryAddress?.pinCode})
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {order.totalItems} Items • Payment: {order.paymentMethod?.toUpperCase()} (₹{order.totalAmount})
                      {order.deliveryAddress?.phone && ` • Phone: ${order.deliveryAddress.phone}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.isDirectOffer && (
                      <button
                        onClick={() => {
                          setRejectOrderId(order._id);
                          setRejectModalOpen(true);
                        }}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold transition border border-slate-200"
                      >
                        Decline
                      </button>
                    )}
                    <button
                      onClick={() => handleAcceptOrder(order._id)}
                      disabled={actionLoadingId === order._id}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                    >
                      {actionLoadingId === order._id ? 'Claiming...' : 'Claim & Accept Delivery'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Active Route & History */
          orders.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-2">
              <PackageCheck className="w-10 h-10 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">
                {activeTab === 'active' ? 'No active orders in your delivery route' : 'No past delivery history'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {activeTab === 'active'
                  ? 'Switch to the "Available for Pickup" tab to claim pending packages.'
                  : 'Delivered orders will be archived here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div
                  key={order._id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {order.orderNumber}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Track: {order.trackingNumber}
                      </span>
                      {getStatusBadge(order.status)}
                      <span className="text-[11px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {order.deliveryAddress?.fullName} — {order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.pinCode}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{order.deliveryAddress?.phone}</span>
                      </span>
                      <span>Collect: <strong className="text-slate-900">₹{order.totalAmount}</strong> ({order.paymentMethod?.toUpperCase()})</span>
                      <span>{order.items?.length || 0} Sealed Packages</span>
                    </div>

                    {/* Timeline mini-note */}
                    {order.statusHistory?.length > 0 && (
                      <p className="text-[10px] text-slate-400 italic">
                        Latest: {order.statusHistory[order.statusHistory.length - 1]?.note}
                      </p>
                    )}
                  </div>

                  {/* Actions for Active Orders */}
                  {activeTab === 'active' && (
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      {order.status === 'assigned' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(order._id, 'picked_up')}
                            disabled={actionLoadingId === order._id}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                          >
                            {actionLoadingId === order._id ? 'Updating...' : 'Confirm Pickup'}
                          </button>
                          <button
                            onClick={() => {
                              setRejectOrderId(order._id);
                              setRejectReason('');
                              setRejectModalOpen(true);
                            }}
                            className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl text-xs font-semibold transition"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {order.status === 'picked_up' && (
                        <button
                          onClick={() => handleUpdateStatus(order._id, 'out_for_delivery')}
                          disabled={actionLoadingId === order._id}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                        >
                          {actionLoadingId === order._id ? 'Updating...' : 'Start Delivery Run'}
                        </button>
                      )}

                      {order.status === 'out_for_delivery' && (
                        <button
                          onClick={() => handleUpdateStatus(order._id, 'delivered')}
                          disabled={actionLoadingId === order._id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          {actionLoadingId === order._id ? 'Completing...' : 'Mark Delivered'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Reject Confirmation Modal */}
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  Decline Order Assignment
                </h3>
                <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
                <p className="text-xs text-slate-600">
                  This order will be unassigned and returned to the hub pool for other available partners.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Reason for declining
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Route full, vehicle mechanical issue"
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    disabled={rejecting}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {rejecting ? 'Declining...' : 'Confirm Decline'}
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

export default ShippingOrdersPage;
