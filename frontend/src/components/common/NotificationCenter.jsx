import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Calendar,
  Pill,
  Activity,
  Truck,
  Star,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

export const NotificationCenter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Fetch unread count & initial notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications?limit=25'),
        api.get('/notifications/unread-count')
      ]);

      if (listRes.data?.success) {
        setNotifications(listRes.data.data || []);
      }
      if (countRes.data?.success) {
        setUnreadCount(countRes.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[NotificationCenter] Error fetching notifications:', err.message);
      setError('Unable to sync notifications right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Socket.io real-time listener
    const socket = getSocket();
    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [user]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark single notification as read
  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await api.patch(`/notifications/${notif._id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('[NotificationCenter] Error marking read:', err.message);
      }
    }

    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationCenter] Error marking all read:', err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'appointment_booked':
      case 'appointment_confirmed':
      case 'appointment_cancelled':
        return <Calendar className="w-4 h-4 text-sky-600" />;
      case 'new_prescription':
        return <Pill className="w-4 h-4 text-emerald-600" />;
      case 'test_recommendation':
        return <Activity className="w-4 h-4 text-teal-600" />;
      case 'order_update':
      case 'delivery_update':
        return <Truck className="w-4 h-4 text-indigo-600" />;
      case 'review_received':
        return <Star className="w-4 h-4 text-amber-500 fill-amber-400" />;
      case 'verification_request':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'doctor_message':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Unread Badge */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-sky-500"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-100 text-sky-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Body List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-sky-600 mb-2" />
                <span className="text-xs font-medium">Checking for notifications...</span>
              </div>
            ) : error ? (
              <div className="py-8 px-4 text-center">
                <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="mt-2 text-xs text-sky-600 hover:underline font-semibold"
                >
                  Try Again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">
                  You have no new notifications at the moment.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3.5 flex items-start gap-3 cursor-pointer transition text-left ${
                    !notif.isRead
                      ? 'bg-sky-50/60 hover:bg-sky-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-white shadow-sm border border-slate-100 shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs font-bold truncate ${
                          !notif.isRead ? 'text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {formatTimestamp(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.link && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-sky-600">
                        <span>View details</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-sky-600 shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-[11px] font-medium text-slate-500">
                VitaLink Real-Time Alerts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
