import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import {
  ShieldCheck,
  Users,
  Stethoscope,
  Truck,
  Activity,
  Lock,
  AlertCircle,
  FileText,
  CheckCircle2,
  Calendar,
  Pill,
  Star,
  TrendingUp,
  RefreshCw,
  Video,
  MessageSquare,
  Building,
  GraduationCap,
  Clock,
  User,
  ExternalLink,
  Search,
  Filter,
  XCircle,
  Send,
  Trash2,
  Eye,
  Mail,
  Check,
  AlertTriangle,
  Shield,
  Settings,
  Database,
  Server,
  UserX,
  UserCheck,
  ClipboardList,
  Layers,
  Phone,
  HelpCircle,
  Inbox
} from 'lucide-react';
import apiClient from '../../api/client';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // Status banner for feedback
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // -------------------------------------------------------------
  // 1. OVERVIEW & ANALYTICS STATE
  // -------------------------------------------------------------
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await apiClient.get('/analytics/admin');
      if (res.data?.success) {
        setAnalytics(res.data.data);
      }
    } catch (err) {
      console.error('[Admin] Analytics load error:', err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 2. DOCTOR VERIFICATION QUEUE STATE
  // -------------------------------------------------------------
  const [verifications, setVerifications] = useState([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPendingVerifications = async () => {
    setVerificationsLoading(true);
    try {
      const res = await apiClient.get('/admin/doctors/pending');
      if (res.data?.success) {
        setVerifications(res.data.data.verifications || []);
      }
    } catch (err) {
      console.error('[Admin] Verifications load error:', err.message);
    } finally {
      setVerificationsLoading(false);
    }
  };

  const handleApproveDoctor = async (doctorId) => {
    setActionLoading(doctorId);
    setStatusMessage({ text: '', type: '' });
    try {
      const res = await apiClient.patch(`/admin/doctors/${doctorId}/approve`, {
        adminNotes: adminNotes || 'Approved by administrator'
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Doctor approved and verified successfully. Profile is now publicly discoverable.', type: 'success' });
        setAdminNotes('');
        setSelectedVerification(null);
        await Promise.all([fetchAnalytics(), fetchPendingVerifications()]);
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Approval failed.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDoctor = async (doctorId) => {
    if (!adminNotes.trim()) {
      return alert('Please enter a rejection reason in the notes field before rejecting.');
    }
    setActionLoading(doctorId);
    setStatusMessage({ text: '', type: '' });
    try {
      const res = await apiClient.patch(`/admin/doctors/${doctorId}/reject`, {
        reason: adminNotes
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Doctor verification rejected.', type: 'success' });
        setAdminNotes('');
        setSelectedVerification(null);
        await Promise.all([fetchAnalytics(), fetchPendingVerifications()]);
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Rejection failed.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async (doctorId) => {
    if (!adminNotes.trim()) {
      return alert('Please specify the requested changes in the notes field.');
    }
    setActionLoading(doctorId);
    setStatusMessage({ text: '', type: '' });
    try {
      const res = await apiClient.patch(`/admin/doctors/${doctorId}/request-changes`, {
        notes: adminNotes
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Changes requested from practitioner successfully.', type: 'success' });
        setAdminNotes('');
        setSelectedVerification(null);
        await Promise.all([fetchAnalytics(), fetchPendingVerifications()]);
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Failed to request changes.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------
  // 3. USERS MANAGEMENT STATE
  // -------------------------------------------------------------
  const [usersList, setUsersList] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRoleFilter, setUsersRoleFilter] = useState('all');
  const [usersStatusFilter, setUsersStatusFilter] = useState('all');
  const [usersSearch, setUsersSearch] = useState('');

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const params = {
        role: usersRoleFilter,
        status: usersStatusFilter,
        search: usersSearch,
        limit: 25
      };
      const res = await apiClient.get('/admin/users', { params });
      if (res.data?.success) {
        setUsersList(res.data.data.users || []);
        setUsersTotal(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('[Admin] Users fetch error:', err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleToggleUserStatus = async (targetId) => {
    try {
      const res = await apiClient.patch(`/admin/users/${targetId}/status`);
      if (res.data?.success) {
        setStatusMessage({ text: res.data.message, type: 'success' });
        fetchUsers();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Status toggle failed.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // 4. APPOINTMENTS OVERSIGHT STATE
  // -------------------------------------------------------------
  const [appointments, setAppointments] = useState([]);
  const [appointmentsTotal, setAppointmentsTotal] = useState(0);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [appTypeFilter, setAppTypeFilter] = useState('all');
  const [appSearch, setAppSearch] = useState('');

  const fetchAppointments = async () => {
    setAppointmentsLoading(true);
    try {
      const params = {
        status: appStatusFilter,
        consultationType: appTypeFilter,
        search: appSearch,
        limit: 25
      };
      const res = await apiClient.get('/admin/appointments', { params });
      if (res.data?.success) {
        setAppointments(res.data.data.appointments || []);
        setAppointmentsTotal(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('[Admin] Appointments fetch error:', err.message);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const handleUpdateAppointment = async (appId, newStatus) => {
    try {
      const res = await apiClient.patch(`/admin/appointments/${appId}/status`, { status: newStatus });
      if (res.data?.success) {
        setStatusMessage({ text: `Appointment status updated to ${newStatus}.`, type: 'success' });
        fetchAppointments();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Update failed.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // 5. CLINICAL RECORDS, PRESCRIPTIONS, TEST REPORTS STATE
  // -------------------------------------------------------------
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const fetchPrescriptions = async () => {
    setPrescriptionsLoading(true);
    try {
      const res = await apiClient.get('/admin/prescriptions', { params: { limit: 25 } });
      if (res.data?.success) setPrescriptions(res.data.data.prescriptions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await apiClient.get('/admin/records', { params: { limit: 25 } });
      if (res.data?.success) setRecords(res.data.data.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRecordsLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await apiClient.get('/admin/reports', { params: { limit: 25 } });
      if (res.data?.success) setReports(res.data.data.reports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setReportsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 6. MEDICINE ORDERS & SHIPPING STATE
  // -------------------------------------------------------------
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shippingPartners, setShippingPartners] = useState([]);
  const [shippingLoading, setShippingLoading] = useState(false);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await apiClient.get('/admin/orders', { params: { limit: 25 } });
      if (res.data?.success) setOrders(res.data.data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchShippingPartners = async () => {
    setShippingLoading(true);
    try {
      const res = await apiClient.get('/admin/shipping-partners');
      if (res.data?.success) setShippingPartners(res.data.data.partners || []);
    } catch (err) {
      console.error(err);
    } finally {
      setShippingLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 7. NOTIFICATIONS & BROADCAST STATE
  // -------------------------------------------------------------
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    targetRole: 'all',
    link: '/'
  });
  const [broadcastSending, setBroadcastSending] = useState(false);

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await apiClient.get('/admin/notifications', { params: { limit: 25 } });
      if (res.data?.success) setNotifications(res.data.data.notifications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      return alert('Please enter both title and message.');
    }
    setBroadcastSending(true);
    try {
      const res = await apiClient.post('/admin/notifications/broadcast', broadcastForm);
      if (res.data?.success) {
        setStatusMessage({ text: res.data.message, type: 'success' });
        setBroadcastForm({ title: '', message: '', targetRole: 'all', link: '/' });
        fetchNotifications();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Broadcast failed.', type: 'error' });
    } finally {
      setBroadcastSending(false);
    }
  };

  // -------------------------------------------------------------
  // 8. REVIEWS & MODERATION STATE
  // -------------------------------------------------------------
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const res = await apiClient.get('/admin/reviews', { params: { limit: 25 } });
      if (res.data?.success) setReviews(res.data.data.reviews || []);
    } catch (err) {
      console.error(err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to remove this patient review? Doctor rating will be recalculated.')) return;
    try {
      const res = await apiClient.delete(`/admin/reviews/${reviewId}`);
      if (res.data?.success) {
        setStatusMessage({ text: 'Review removed from platform.', type: 'success' });
        fetchReviews();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Deletion failed.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // 9. CONTACT MESSAGES STATE
  // -------------------------------------------------------------
  const [contactMessages, setContactMessages] = useState([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [contactResponseText, setContactResponseText] = useState('');

  const fetchContactMessages = async () => {
    setContactLoading(true);
    try {
      const res = await apiClient.get('/admin/contact-messages', { params: { limit: 25 } });
      if (res.data?.success) setContactMessages(res.data.data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleUpdateContact = async (id, status, response) => {
    try {
      const res = await apiClient.patch(`/admin/contact-messages/${id}`, {
        status,
        adminResponse: response
      });
      if (res.data?.success) {
        setStatusMessage({ text: 'Inquiry updated.', type: 'success' });
        setSelectedMessage(null);
        fetchContactMessages();
      }
    } catch (err) {
      setStatusMessage({ text: err.response?.data?.message || 'Failed to update inquiry.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // 10. AUDIT LOGS STATE
  // -------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await apiClient.get('/admin/audit-logs', { params: { limit: 30 } });
      if (res.data?.success) setAuditLogs(res.data.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 11. SYSTEM STATUS & SETTINGS STATE
  // -------------------------------------------------------------
  const [systemStatus, setSystemStatus] = useState(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);

  const fetchSystemStatus = async () => {
    setSystemStatusLoading(true);
    try {
      const res = await apiClient.get('/admin/system-status');
      if (res.data?.success) setSystemStatus(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSystemStatusLoading(false);
    }
  };

  // Tab switching loader
  useEffect(() => {
    switch (currentTab) {
      case 'overview':
        fetchAnalytics();
        fetchPendingVerifications();
        break;
      case 'verifications':
        fetchPendingVerifications();
        break;
      case 'users':
        fetchUsers();
        break;
      case 'appointments':
        fetchAppointments();
        break;
      case 'prescriptions':
        fetchPrescriptions();
        break;
      case 'records':
        fetchRecords();
        break;
      case 'reports':
        fetchReports();
        break;
      case 'orders':
        fetchOrders();
        break;
      case 'shipping':
        fetchShippingPartners();
        break;
      case 'notifications':
        fetchNotifications();
        break;
      case 'reviews':
        fetchReviews();
        break;
      case 'contact':
        fetchContactMessages();
        break;
      case 'audit':
        fetchAuditLogs();
        break;
      case 'settings':
        fetchSystemStatus();
        break;
      default:
        fetchAnalytics();
    }
  }, [currentTab]);

  const overview = analytics?.overview || {};

  const navigationSections = [
    { id: 'overview', label: 'Overview & KPIs', icon: TrendingUp },
    { id: 'verifications', label: 'Doctor Verification', icon: ShieldCheck, badge: verifications.length },
    { id: 'users', label: 'Platform Users', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'records', label: 'Medical Records', icon: FileText },
    { id: 'reports', label: 'Test Reports', icon: Activity },
    { id: 'orders', label: 'Medicine Orders', icon: Truck },
    { id: 'shipping', label: 'Logistics Partners', icon: Building },
    { id: 'notifications', label: 'Broadcast & Alerts', icon: Send },
    { id: 'reviews', label: 'Reviews & Feedback', icon: Star },
    { id: 'contact', label: 'Care Inquiries', icon: Inbox },
    { id: 'audit', label: 'Compliance Audit', icon: Lock },
    { id: 'settings', label: 'System & Security', icon: Settings }
  ];

  return (
    <DashboardLayout title="VitaLink Central Administration">
      {/* Top Banner Alert / Status Notification */}
      {statusMessage.text && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center justify-between text-sm font-semibold transition ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage({ text: '', type: '' })} className="p-1 hover:opacity-75">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Pills Bar */}
      <div className="mb-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {navigationSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = currentTab === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setTab(sec.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{sec.label}</span>
                {sec.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white text-sky-700' : 'bg-rose-500 text-white'
                  }`}>
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. OVERVIEW & KPIS TAB */}
      {/* ==================================================== */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden border border-slate-800 shadow-lg">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Shield className="w-64 h-64 text-cyan-400" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold tracking-wide uppercase mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Administrative Security Boundary Active</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                Platform Operations & Governance
              </h1>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Full-spectrum oversight over clinical verifications, patient consultations, telemedicine sessions, pharmacy orders, and compliance audit records.
              </p>
            </div>
          </div>

          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Patients Registered</span>
                <Users className="w-5 h-5 text-sky-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.totalPatients ?? 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">Platform user base</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Verified Doctors</span>
                <Stethoscope className="w-5 h-5 text-teal-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.verifiedDoctors ?? 0}</div>
              <div className="text-[11px] text-teal-600 font-semibold mt-1">
                {overview.pendingVerifications ?? 0} pending verification
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Consultations</span>
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.totalAppointments ?? 0}</div>
              <div className="text-[11px] text-indigo-600 font-semibold mt-1">
                {overview.appointmentCompletionRate ?? 0}% completed successfully
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Medicine Orders</span>
                <Truck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{overview.totalOrders ?? 0}</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                {overview.orderFulfillmentRate ?? 0}% delivery fulfillment
              </div>
            </div>
          </div>

          {/* Secondary Stats & Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Consultation Types Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Video className="w-4 h-4 text-sky-600" />
                <span>Consultations by Modality</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-sky-600" /> Video Sessions</span>
                    <span>{analytics?.consultations?.types?.video ?? 0}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{
                        width: `${Math.min(100, ((analytics?.consultations?.types?.video || 0) / Math.max(1, overview.totalAppointments || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-teal-600" /> Real-time Chat</span>
                    <span>{analytics?.consultations?.types?.chat ?? 0}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{
                        width: `${Math.min(100, ((analytics?.consultations?.types?.chat || 0) / Math.max(1, overview.totalAppointments || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5 text-indigo-600" /> In-Clinic Physical</span>
                    <span>{analytics?.consultations?.types?.physical ?? 0}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{
                        width: `${Math.min(100, ((analytics?.consultations?.types?.physical || 0) / Math.max(1, overview.totalAppointments || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Volume Stats */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Clinical Volumes</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Prescriptions</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{overview.totalPrescriptions ?? 0}</div>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Medical Records</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{overview.totalRecords ?? 0}</div>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Test Reports</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{overview.totalTestReports ?? 0}</div>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Reviews Logged</div>
                  <div className="text-xl font-black text-slate-900 mt-1">{overview.totalReviews ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-600" />
                  <span>Platform Revenue</span>
                </h3>
                <div className="text-3xl font-black text-slate-900">
                  ₹{(overview.totalRevenue || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 mt-1">Total consultation & pharmacy transacted value</div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Consultation Fees:</span>
                    <span className="font-bold text-slate-900">₹{(analytics?.financials?.consultationRevenue || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Pharmacy Deliveries:</span>
                    <span className="font-bold text-slate-900">₹{(analytics?.financials?.medicineSalesRevenue || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => setTab('verifications')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Review Pending Doctors ({verifications.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. DOCTOR VERIFICATION TAB */}
      {/* ==================================================== */}
      {currentTab === 'verifications' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-bold uppercase mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Credential Review Protocol</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Doctor Credential Verification Queue</h2>
              <p className="text-xs text-slate-500 mt-1">
                Only state-registered, verified practitioners appear in public search and accept consultations.
              </p>
            </div>
            <button
              onClick={fetchPendingVerifications}
              disabled={verificationsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 self-start md:self-auto transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verificationsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {verificationsLoading ? (
            <div className="p-12 text-center text-slate-500 font-semibold">Loading verification queue...</div>
          ) : verifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Verification Queue Clear</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                There are currently no doctor credential submissions awaiting administrative review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {verifications.map((item) => {
                const doctor = item.doctor || {};
                const profile = item.doctorProfile || {};
                const doctorId = doctor._id || profile.user;
                const isSelected = selectedVerification?._id === item._id;

                return (
                  <div
                    key={item._id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 transition"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-lg border border-teal-200 shrink-0">
                          {doctor.fullName ? doctor.fullName.charAt(0) : 'D'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{doctor.fullName || 'Medical Practitioner'}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              {item.status || profile.verificationStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>{doctor.email}</span>
                            <span>•</span>
                            <span>{doctor.phone || 'Phone not set'}</span>
                            <span>•</span>
                            <span>{profile.specialization || 'General Physician'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={() => setSelectedVerification(isSelected ? null : item)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isSelected ? 'Hide Details' : 'Inspect Credentials'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Detailed Credential Inspection Drawer */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl">
                          <div>
                            <span className="font-bold text-slate-500 uppercase text-[10px] block">Registration No.</span>
                            <span className="font-bold text-slate-900">{profile.medicalRegistrationNumber || 'Pending'}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-500 uppercase text-[10px] block">Degree & College</span>
                            <span className="font-bold text-slate-900">{profile.highestDegree || 'MBBS'} ({profile.college || 'Not specified'})</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-500 uppercase text-[10px] block">Experience</span>
                            <span className="font-bold text-slate-900">{profile.experienceYears || 0} Years</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-500 uppercase text-[10px] block">Hospital / Clinic</span>
                            <span className="font-bold text-slate-900">{profile.hospitalName || 'Independent'}</span>
                          </div>
                        </div>

                        {/* Document Attachments */}
                        <div>
                          <span className="text-xs font-bold text-slate-700 block mb-2">Uploaded Verification Proofs:</span>
                          {item.documents && item.documents.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.documents.map((doc, dIdx) => (
                                <a
                                  key={dIdx}
                                  href={`/api/v1/admin/verification-documents/${doc.fileName}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold hover:bg-sky-100 transition"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>{doc.docType.replace('_', ' ').toUpperCase()}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No document files uploaded in submission.</p>
                          )}
                        </div>

                        {/* Admin Action Box */}
                        <div className="bg-slate-900 p-4 rounded-xl text-white">
                          <label className="text-xs font-bold text-slate-300 block mb-1">
                            Administrator Review Notes (Required for Rejection or Changes):
                          </label>
                          <textarea
                            rows={2}
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Enter notes, requirements, or reason for approval/rejection..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />

                          <div className="flex items-center justify-end gap-2 mt-3">
                            <button
                              disabled={actionLoading === doctorId}
                              onClick={() => handleRequestChanges(doctorId)}
                              className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition"
                            >
                              Request Changes
                            </button>
                            <button
                              disabled={actionLoading === doctorId}
                              onClick={() => handleRejectDoctor(doctorId)}
                              className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition"
                            >
                              Reject Credentials
                            </button>
                            <button
                              disabled={actionLoading === doctorId}
                              onClick={() => handleApproveDoctor(doctorId)}
                              className="px-4 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 transition flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve & Verify</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. USER DIRECTORY TAB */}
      {/* ==================================================== */}
      {currentTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Platform User Directory</h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage accounts across all system roles: Patients, Doctors, Logistics Partners, and Administrators.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-500">
              Total Accounts: <span className="text-slate-900 font-black">{usersTotal}</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                placeholder="Search by name, email, phone, city..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={usersRoleFilter}
                onChange={(e) => setUsersRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">All Roles</option>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="shipping">Shipping Partner</option>
                <option value="admin">Administrator</option>
              </select>

              <select
                value={usersStatusFilter}
                onChange={(e) => setUsersStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                onClick={fetchUsers}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 transition shrink-0"
              >
                Filter
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                        Loading platform users...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                        No users found matching query criteria.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => {
                      const isSelf = u._id === user?._id;
                      return (
                        <tr key={u._id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{u.fullName || 'User'}</div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              u.role === 'admin'
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                : u.role === 'doctor'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : u.role === 'shipping'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-sky-50 text-sky-700 border border-sky-200'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600">
                            <div>{u.phone || '—'}</div>
                            <div className="text-[11px] text-slate-400">{u.city ? `${u.city}, ${u.state || ''}` : 'Location unconfigured'}</div>
                          </td>
                          <td className="p-4 text-slate-600">
                            {u.role === 'doctor' && u.doctorProfile && (
                              <div className="text-[11px]">
                                <span className="font-bold">{u.doctorProfile.specialization}</span>
                                <div className="text-slate-400">
                                  {u.doctorProfile.isVerified ? 'Verified Specialist' : 'Pending Verification'}
                                </div>
                              </div>
                            )}
                            {u.role === 'shipping' && u.shippingProfile && (
                              <div className="text-[11px]">
                                <span className="font-bold">{u.shippingProfile.companyName || 'Logistics Partner'}</span>
                                <div className="text-slate-400">{u.shippingProfile.vehicleType || 'Courier'}</div>
                              </div>
                            )}
                            {u.role !== 'doctor' && u.role !== 'shipping' && (
                              <span className="text-slate-400 text-[11px]">Standard Account</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {isSelf ? (
                              <span className="text-[10px] font-bold text-slate-400 italic">Self (Admin)</span>
                            ) : (
                              <button
                                onClick={() => handleToggleUserStatus(u._id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                  u.isActive
                                    ? 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                                    : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. APPOINTMENTS MONITOR TAB */}
      {/* ==================================================== */}
      {currentTab === 'appointments' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Consultation Appointments Registry</h2>
              <p className="text-xs text-slate-500 mt-1">
                Monitor and administer teleconsultation video calls, secure chats, and physical hospital visits.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-500">
              Total Sessions: <span className="text-slate-900 font-black">{appointmentsTotal}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAppointments()}
                placeholder="Search patient or doctor name, reason..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={appTypeFilter}
                onChange={(e) => setAppTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
              >
                <option value="all">All Modalities</option>
                <option value="video">Video</option>
                <option value="chat">Chat</option>
                <option value="physical">Physical</option>
              </select>

              <button
                onClick={fetchAppointments}
                className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 transition shrink-0"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Doctor</th>
                    <th className="p-4">Schedule</th>
                    <th className="p-4">Modality</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointmentsLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">Loading appointments...</td></tr>
                  ) : appointments.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">No appointments found.</td></tr>
                  ) : (
                    appointments.map((a) => (
                      <tr key={a._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{a.patient?.fullName || 'Patient'}</div>
                          <div className="text-[11px] text-slate-500">{a.patient?.email}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{a.doctor?.fullName || 'Doctor'}</div>
                          <div className="text-[11px] text-slate-500">{a.reason?.slice(0, 35)}...</div>
                        </td>
                        <td className="p-4 text-slate-600">
                          <div className="font-bold">{new Date(a.date).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-400">{a.timeSlot?.start} - {a.timeSlot?.end}</div>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 font-bold uppercase text-[10px] text-slate-700">
                            {a.consultationType === 'video' && <Video className="w-3.5 h-3.5 text-sky-600" />}
                            {a.consultationType === 'chat' && <MessageSquare className="w-3.5 h-3.5 text-teal-600" />}
                            {a.consultationType === 'physical' && <Building className="w-3.5 h-3.5 text-indigo-600" />}
                            <span>{a.consultationType}</span>
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            a.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : a.status === 'confirmed'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : a.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900">
                          ₹{a.fee || 500}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. CLINICAL PRESCRIPTIONS TAB */}
      {/* ==================================================== */}
      {currentTab === 'prescriptions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Digital Clinical Prescriptions</h2>
              <p className="text-xs text-slate-500 mt-1">Platform prescriptions issued by licensed medical specialists.</p>
            </div>
            <button onClick={fetchPrescriptions} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Doctor (Issuer)</th>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Clinical Assessment</th>
                    <th className="p-4">Medications</th>
                    <th className="p-4">Date Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prescriptionsLoading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">Loading prescriptions...</td></tr>
                  ) : prescriptions.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">No prescriptions issued yet.</td></tr>
                  ) : (
                    prescriptions.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-900">{p.doctor?.fullName || 'Dr. Physician'}</td>
                        <td className="p-4 text-slate-700">{p.patient?.fullName || 'Patient'}</td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">{p.clinicalAssessment || 'Clinical evaluation'}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            {p.medications?.length || 0} item(s)
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. MEDICAL RECORDS TAB */}
      {/* ==================================================== */}
      {currentTab === 'records' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Patient Electronic Medical Records (EMR)</h2>
              <p className="text-xs text-slate-500 mt-1">Aggregated clinical records, diagnoses, and lab attachments.</p>
            </div>
            <button onClick={fetchRecords} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Record Title</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Summary</th>
                    <th className="p-4">Recorded Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recordsLoading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">Loading EMR logs...</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">No medical records on file.</td></tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-900">{r.title}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {r.recordType}
                          </span>
                        </td>
                        <td className="p-4 text-slate-700">{r.patient?.fullName || 'Patient'}</td>
                        <td className="p-4 text-slate-600 max-w-sm truncate">{r.summary || 'Clinical record on file'}</td>
                        <td className="p-4 text-slate-500">{new Date(r.date || r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. TEST REPORTS TAB */}
      {/* ==================================================== */}
      {currentTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Diagnostic Test Reports</h2>
              <p className="text-xs text-slate-500 mt-1">Diagnostic lab examinations, pathology reports, and specialist recommendations.</p>
            </div>
            <button onClick={fetchReports} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Test Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Doctor</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportsLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">Loading test reports...</td></tr>
                  ) : reports.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">No diagnostic reports logged.</td></tr>
                  ) : (
                    reports.map((rp) => (
                      <tr key={rp._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-900">{rp.testName}</td>
                        <td className="p-4 text-slate-600">{rp.category || 'General'}</td>
                        <td className="p-4 text-slate-700">{rp.patient?.fullName || 'Patient'}</td>
                        <td className="p-4 text-slate-700">{rp.doctor?.fullName || 'Physician'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            rp.status === 'reviewed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rp.status === 'uploaded'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {rp.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{new Date(rp.date || rp.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 8. MEDICINE ORDERS TAB */}
      {/* ==================================================== */}
      {currentTab === 'orders' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Medicine Orders & Fulfillment</h2>
              <p className="text-xs text-slate-500 mt-1">Manage pharmacy dispatch, medication packaging, and delivery tracking.</p>
            </div>
            <button onClick={fetchOrders} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Recipient</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Delivery Carrier</th>
                    <th className="p-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ordersLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">Loading orders...</td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">No pharmacy orders placed.</td></tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-sky-700">#{o.orderNumber || o._id.slice(-6)}</td>
                        <td className="p-4 text-slate-900 font-medium">{o.deliveryAddress?.fullName || o.patient?.fullName}</td>
                        <td className="p-4 text-slate-600">{o.deliveryAddress?.city}, {o.deliveryAddress?.state}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            o.status === 'delivered'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : o.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {o.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600">{o.shippingPartner?.fullName || 'Unassigned'}</td>
                        <td className="p-4 text-right font-bold text-slate-900">₹{o.totalAmount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 9. LOGISTICS PARTNERS TAB */}
      {/* ==================================================== */}
      {currentTab === 'shipping' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Shipping & Logistics Partner Fleet</h2>
              <p className="text-xs text-slate-500 mt-1">Courier verification, fleet availability, and assigned delivery capacity.</p>
            </div>
            <button onClick={fetchShippingPartners} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {shippingLoading ? (
              <div className="col-span-full p-8 text-center text-slate-400 font-semibold">Loading partners...</div>
            ) : shippingPartners.length === 0 ? (
              <div className="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                No shipping profiles registered yet.
              </div>
            ) : (
              shippingPartners.map((p) => (
                <div key={p._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-sm">{p.companyName || p.user?.fullName || 'Logistics Partner'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.isAvailable ? 'Available' : 'Busy'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>Contact: {p.phone || p.user?.phone || '—'}</div>
                      <div>Vehicle: {p.vehicleType} ({p.vehicleNumber || 'Unregistered'})</div>
                      <div>City: {p.user?.city || 'Local area'}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs">
                    <span className="text-slate-500">Active Shipments:</span>
                    <span className="font-bold text-slate-900">{p.activeDeliveriesCount || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 10. BROADCAST & NOTIFICATIONS TAB */}
      {/* ==================================================== */}
      {currentTab === 'notifications' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Broadcast Form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-600" />
                <span>Broadcast Platform Alert</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Dispatch an immediate system announcement to platform users.
              </p>

              <form onSubmit={handleBroadcast} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Audience</label>
                  <select
                    value={broadcastForm.targetRole}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, targetRole: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:outline-none"
                  >
                    <option value="all">All Registered Users</option>
                    <option value="patient">Patients Only</option>
                    <option value="doctor">Doctors Only</option>
                    <option value="shipping">Logistics Partners Only</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Announcement Title</label>
                  <input
                    type="text"
                    required
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                    placeholder="e.g. VitaLink Platform Scheduled Maintenance"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Message Body</label>
                  <textarea
                    rows={4}
                    required
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    placeholder="Provide clear instructions or status update..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Destination Link</label>
                  <input
                    type="text"
                    value={broadcastForm.link}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, link: e.target.value })}
                    placeholder="/"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={broadcastSending}
                  className="w-full py-2.5 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-500 transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{broadcastSending ? 'Dispatching...' : 'Dispatch Broadcast'}</span>
                </button>
              </form>
            </div>

            {/* Notification History Feed */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">Recent System Notifications</h3>
                <button onClick={fetchNotifications} className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  Refresh
                </button>
              </div>

              {notifLoading ? (
                <div className="p-8 text-center text-slate-400 font-semibold text-xs">Loading alerts...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No notifications recorded.</div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {notifications.map((n) => (
                    <div key={n._id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3 text-xs">
                      <div className="p-2 rounded-lg bg-white border border-slate-200 text-sky-600 shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate">{n.title}</span>
                          <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{n.message}</p>
                        <div className="text-[10px] text-slate-400 mt-1">Recipient: {n.recipient?.fullName || 'User'} ({n.recipient?.role || 'user'})</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 11. REVIEWS & MODERATION TAB */}
      {/* ==================================================== */}
      {currentTab === 'reviews' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Patient Reviews & Content Moderation</h2>
              <p className="text-xs text-slate-500 mt-1">Monitor clinical consultation feedback and remove inappropriate content.</p>
            </div>
            <button onClick={fetchReviews} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsLoading ? (
              <div className="col-span-full p-8 text-center text-slate-400 font-semibold text-xs">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                No patient reviews submitted yet.
              </div>
            ) : (
              reviews.map((rev) => (
                <div key={rev._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1 text-amber-500">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                          />
                        ))}
                        <span className="font-bold text-xs text-slate-700 ml-1">({rev.rating}/5)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="text-xs text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
                      "{rev.comment || 'No written commentary.'}"
                    </p>

                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Patient: <strong className="text-slate-900">{rev.patient?.fullName || 'Patient'}</strong></span>
                      <span>Doctor: <strong className="text-slate-900">{rev.doctor?.fullName || 'Doctor'}</strong></span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleDeleteReview(rev._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Moderate / Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 12. CONTACT INQUIRIES TAB */}
      {/* ==================================================== */}
      {currentTab === 'contact' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Care Inquiries & Public Inquiries Inbox</h2>
              <p className="text-xs text-slate-500 mt-1">Direct feedback and assistance requests submitted from the landing page.</p>
            </div>
            <button onClick={fetchContactMessages} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {contactLoading ? (
              <div className="p-8 text-center text-slate-400 font-semibold text-xs">Loading inquiries...</div>
            ) : contactMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                No inquiries submitted yet.
              </div>
            ) : (
              contactMessages.map((msg) => (
                <div key={msg._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{msg.name}</span>
                      <span className="text-xs text-slate-500">&lt;{msg.email}&gt;</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        msg.status === 'responded'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : msg.status === 'read'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {msg.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="text-xs font-bold text-slate-800 mb-1">Subject: {msg.subject}</div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3 leading-relaxed">
                    {msg.message}
                  </p>

                  {msg.adminResponse && (
                    <div className="text-xs bg-teal-50 border border-teal-200 text-teal-900 p-3 rounded-xl mb-3">
                      <strong className="block text-[10px] font-bold uppercase text-teal-700 mb-0.5">Admin Response / Action Note:</strong>
                      {msg.adminResponse}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 text-xs">
                    {msg.status !== 'read' && (
                      <button
                        onClick={() => handleUpdateContact(msg._id, 'read', msg.adminResponse)}
                        className="px-3 py-1 rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Mark Read
                      </button>
                    )}
                    {selectedMessage?._id === msg._id ? (
                      <div className="w-full flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={contactResponseText}
                          onChange={(e) => setContactResponseText(e.target.value)}
                          placeholder="Type internal response or resolution notes..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => handleUpdateContact(msg._id, 'responded', contactResponseText)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold hover:bg-sky-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setSelectedMessage(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setSelectedMessage(msg); setContactResponseText(msg.adminResponse || ''); }}
                        className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold border border-sky-200 hover:bg-sky-100"
                      >
                        Add Response Note
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 13. COMPLIANCE AUDIT LOGS TAB */}
      {/* ==================================================== */}
      {currentTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-bold uppercase mb-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Immutable Security Trail</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Compliance & Regulatory Audit Logs</h2>
              <p className="text-xs text-slate-500 mt-1">Full historical trace of administrative authorizations, approvals, and security updates.</p>
            </div>
            <button onClick={fetchAuditLogs} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Action</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">IP / Client</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {auditLoading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-semibold font-sans">Loading audit entries...</td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-sans">No audit events recorded.</td></tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-900">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-slate-700">
                          {log.performedBy?.fullName || log.performedBy?.email || 'System'}
                        </td>
                        <td className="p-4 text-slate-600 max-w-xs truncate font-sans">
                          {JSON.stringify(log.details)}
                        </td>
                        <td className="p-4 text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                        <td className="p-4 text-slate-500 font-sans">{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 14. SETTINGS & SYSTEM STATUS TAB */}
      {/* ==================================================== */}
      {currentTab === 'settings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin Profile Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-sky-600" />
                <span>Admin Profile Information</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Administrator Name:</span>
                  <span className="font-bold text-slate-900">{user?.fullName || 'System Administrator'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Registered Admin Email:</span>
                  <span className="font-bold text-slate-900">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Database Role:</span>
                  <span className="font-bold text-cyan-600 uppercase">{user?.role}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Account Authorization:</span>
                  <span className="font-bold text-emerald-600">Strict RBAC Enforced</span>
                </div>
              </div>
            </div>

            {/* Platform Security Boundaries */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Security & Boundary Verification</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Public registration strictly restricts <code>role === "admin"</code>.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Single unified login route: Admins log in at <code>/login</code> and auto-route to <code>/admin</code>.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unverified, pending, and rejected doctors are completely excluded from public discovery.</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sensitive credential verification documents streamed through private admin authorization only.</span>
                </div>
              </div>
            </div>

            {/* Diagnostic System Info */}
            <div className="col-span-full bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm">System Diagnostics & Environmental State</span>
                </div>
                <button
                  onClick={fetchSystemStatus}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Refresh State
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-[10px] uppercase">Node Runtime</div>
                  <div className="text-white font-bold mt-0.5">{systemStatus?.server?.nodeVersion || 'v20.x'}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-[10px] uppercase">Database Connection</div>
                  <div className="text-emerald-400 font-bold mt-0.5">{systemStatus?.database?.status || 'Connected'}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-[10px] uppercase">Server Environment</div>
                  <div className="text-cyan-400 font-bold mt-0.5">{systemStatus?.server?.environment || 'development'}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-slate-400 text-[10px] uppercase">Uptime (Seconds)</div>
                  <div className="text-white font-bold mt-0.5">{systemStatus?.server?.uptimeSeconds || 0}s</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
