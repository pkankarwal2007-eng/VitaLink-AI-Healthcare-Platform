import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  User,
  X
} from 'lucide-react';

export const AdminOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [shippingPartnerId, setShippingPartnerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState(null);

  // Tracking modal
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiClient.get('/orders', { params });
      if (res.data?.success) {
        setOrders(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError(err.response?.data?.message || 'Failed to load platform orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const handlePackOrder = async (orderId) => {
    try {
      const res = await apiClient.patch(`/shipping/orders/${orderId}/pack`);
      if (res.data?.success) {
        setSuccessMsg('Order marked as packed and ready for shipping!');
        fetchOrders();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to pack order.');
    }
  };

  const handleOpenAssign = (order) => {
    setSelectedOrder(order);
    setShippingPartnerId('');
    setAssignError(null);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!shippingPartnerId.trim()) {
      setAssignError('Please enter a valid shipping partner user ID.');
      return;
    }

    try {
      setAssigning(true);
      setAssignError(null);
      const res = await apiClient.post(`/shipping/orders/${selectedOrder._id}/assign`, {
        shippingPartnerId: shippingPartnerId.trim()
      });

      if (res.data?.success) {
        setSuccessMsg(`Order ${selectedOrder.orderNumber} successfully assigned to shipping partner!`);
        setAssignModalOpen(false);
        fetchOrders();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign shipping partner.');
    } finally {
      setAssigning(false);
    }
  };

  const handleViewTracking = async (orderId) => {
    try {
      const res = await apiClient.get(`/orders/${orderId}/track`);
      if (res.data?.success) {
        setSelectedTracking(res.data.data);
        setTrackingModalOpen(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch tracking details.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Confirmed</span>;
      case 'packed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Packed</span>;
      case 'assigned':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Assigned</span>;
      case 'picked_up':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">Picked Up</span>;
      case 'out_for_delivery':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">In Transit</span>;
      case 'delivered':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Delivered</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <DashboardLayout title="Logistics & Orders Oversight">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-600" />
              <span>Platform Orders & Delivery Oversight</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor prescription orders, verify packing, assign delivery partners, and audit live logistics.
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

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {[
              { key: 'all', label: 'All Orders' },
              { key: 'confirmed', label: 'Confirmed' },
              { key: 'packed', label: 'Packed' },
              { key: 'assigned', label: 'Assigned' },
              { key: 'out_for_delivery', label: 'In Transit' },
              { key: 'delivered', label: 'Delivered' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order or tracking #..."
              className="w-full md:w-60 px-3 py-1.5 text-xs border border-slate-300 rounded-xl outline-none"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Search
            </button>
          </form>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-36 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-2">
            <Package className="w-10 h-10 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">No orders match this query</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Incoming patient prescription orders will be listed here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div
                key={order._id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {order.orderNumber}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Track: {order.trackingNumber}
                    </span>
                    {getStatusBadge(order.status)}
                    <span className="text-[11px] text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Patient: {order.patient?.fullName} ({order.deliveryAddress?.city}, {order.deliveryAddress?.state})
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    {order.items?.length || 0} Meds • Amount: ₹{order.totalAmount} • Courier: {order.shippingPartner?.fullName || 'Unassigned'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    onClick={() => handleViewTracking(order._id)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Track
                  </button>

                  {order.status === 'confirmed' && (
                    <button
                      onClick={() => handlePackOrder(order._id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      Pack Order
                    </button>
                  )}

                  {['confirmed', 'packed'].includes(order.status) && (
                    <button
                      onClick={() => handleOpenAssign(order)}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      Assign Courier
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assign Modal */}
        {assignModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-teal-600" />
                  Assign Shipping Partner
                </h3>
                <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="mt-4 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <p><span className="font-bold">Order: </span>{selectedOrder.orderNumber}</p>
                  <p><span className="font-bold">City: </span>{selectedOrder.deliveryAddress?.city}</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Shipping Partner User ID *
                  </label>
                  <input
                    type="text"
                    value={shippingPartnerId}
                    onChange={(e) => setShippingPartnerId(e.target.value)}
                    placeholder="Enter registered Shipping User ObjectId"
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none"
                    required
                  />
                </div>

                {assignError && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                    {assignError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {assigning ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tracking Details Modal */}
        {trackingModalOpen && selectedTracking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-teal-600" />
                  Order #{selectedTracking.orderNumber}
                </h3>
                <button onClick={() => setTrackingModalOpen(false)} className="text-slate-400 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p><span className="font-bold">Tracking Number: </span>{selectedTracking.trackingNumber}</p>
                  <p><span className="font-bold">Status: </span>{selectedTracking.status}</p>
                  <p><span className="font-bold">Destination: </span>{selectedTracking.deliveryCity}, {selectedTracking.deliveryState} ({selectedTracking.deliveryPinCode})</p>
                  <p><span className="font-bold">Carrier: </span>{selectedTracking.carrier}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Status History</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-3">
                    {selectedTracking.statusHistory?.map((h, i) => (
                      <div key={i} className="py-2">
                        <div className="flex justify-between font-bold text-slate-800 uppercase text-[10px]">
                          <span>{h.status}</span>
                          <span className="text-slate-400 font-normal">{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-500 mt-0.5">{h.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setTrackingModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminOrdersPage;
