import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import apiClient from '../../api/client';
import {
  Truck,
  PackageCheck,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Phone,
  ArrowRight,
  Package,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ShippingDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchShippingData();
  }, []);

  const fetchShippingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profRes, ordRes, availRes] = await Promise.all([
        apiClient.get('/shipping/profile'),
        apiClient.get('/shipping/orders?status=active'),
        apiClient.get('/shipping/orders/available')
      ]);

      if (profRes.data?.success) {
        setProfile(profRes.data.data);
      }
      if (ordRes.data?.success) {
        setActiveOrders(ordRes.data.data || []);
      }
      if (availRes.data?.success) {
        setAvailableCount((availRes.data.data || []).length);
      }
    } catch (err) {
      console.error('Failed to load shipping dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load shipping data.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      setUpdatingId(orderId);
      const res = await apiClient.patch(`/shipping/orders/${orderId}/status`, {
        status: nextStatus
      });

      if (res.data?.success) {
        setSuccessMsg(`Order updated to "${nextStatus.replace('_', ' ')}"!`);
        fetchShippingData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update delivery status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DashboardLayout title="Logistics & Dispatch Hub">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header / Welcome */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-8 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">
              Verified Logistics Network
            </div>
            <h1 className="text-2xl font-black">
              {profile?.companyName || user?.fullName || 'Shipping Partner'}
            </h1>
            <p className="text-slate-300 text-xs mt-1 max-w-xl">
              Pickup, transport, and fulfill clinical prescription medicine shipments with live patient tracking.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchShippingData}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <Link
              to="/shipping/orders"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition flex items-center gap-2"
            >
              <span>Dispatch Orders</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
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

        {availableCount > 0 && (
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
              <span className="font-bold">
                {availableCount} prescription package{availableCount > 1 ? 's' : ''} available for pickup in your service area!
              </span>
            </div>
            <Link
              to="/shipping/orders"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1"
            >
              <span>Claim Packages</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Active Deliveries</span>
              <Truck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {activeOrders.length}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">In transit or ready for pickup</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Total Completed</span>
              <PackageCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {profile?.totalDeliveredCount || 0}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Delivered to patients</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Vehicle Type</span>
              <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                {profile?.vehicleType || 'Courier'}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-800 mt-2 truncate">
              {profile?.vehicleNumber || 'Registered'}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Status: {profile?.isAvailable ? 'Available' : 'Offline'}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Partner Rating</span>
              <span className="text-amber-500 text-sm">★</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {profile?.rating || '5.0'}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">VitaLink Quality Score</p>
          </div>
        </div>

        {/* Active Route Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Active Delivery Queue ({activeOrders.length})</span>
            </h2>
            <Link
              to="/shipping/orders"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View All Dispatch Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map(n => (
                <div key={n} className="h-32 bg-slate-200 rounded-2xl" />
              ))}
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-2">
              <PackageCheck className="w-10 h-10 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800">No active deliveries right now</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Check the orders tab to view and claim available prescription packages ready for pharmacy pickup.
              </p>
              <Link
                to="/shipping/orders"
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                Find Available Packages
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map(order => (
                <div
                  key={order._id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {order.status?.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {order.totalItems} Items • COD Amount: ₹{order.totalAmount}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {order.deliveryAddress?.fullName} — {order.deliveryAddress?.street}, {order.deliveryAddress?.city}, {order.deliveryAddress?.pinCode}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Contact: {order.deliveryAddress?.phone}</span>
                    </div>
                  </div>

                  {/* Delivery Status Controls */}
                  <div className="flex items-center gap-2">
                    {order.status === 'assigned' && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, 'picked_up')}
                        disabled={updatingId === order._id}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                      >
                        {updatingId === order._id ? 'Updating...' : 'Mark Picked Up'}
                      </button>
                    )}

                    {order.status === 'picked_up' && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, 'out_for_delivery')}
                        disabled={updatingId === order._id}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                      >
                        {updatingId === order._id ? 'Updating...' : 'Start Delivery'}
                      </button>
                    )}

                    {order.status === 'out_for_delivery' && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, 'delivered')}
                        disabled={updatingId === order._id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                      >
                        {updatingId === order._id ? 'Updating...' : 'Mark Delivered'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ShippingDashboard;
