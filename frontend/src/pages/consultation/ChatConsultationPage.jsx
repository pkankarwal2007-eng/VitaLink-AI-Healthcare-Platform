import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { getSocket } from '../../services/socket';
import {
  MessageSquare,
  Send,
  User,
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  Check,
  CheckCheck,
  Video,
  Info
} from 'lucide-react';

export const ChatConsultationPage = () => {
  const { appointmentId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const messagesEndRef = useRef(null);

  // Authenticated user's ID
  const currentUserId = useMemo(() => {
    return (user?._id || user?.id)?.toString() || '';
  }, [user]);

  useEffect(() => {
    fetchChatHistory();
  }, [appointmentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Setup Socket.IO real-time listener for this consultation
  useEffect(() => {
    if (!appointmentId) return;

    const socket = getSocket();

    // Join room
    socket.emit('join-chat-room', { appointmentId }, (response) => {
      if (!response?.success) {
        console.warn('Failed to join chat room:', response?.error);
      }
    });

    const handleNewMessage = (newMsg) => {
      const roomAptId = String(newMsg?.appointment?._id || newMsg?.appointment || '');
      if (roomAptId === String(appointmentId)) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    socket.on('new-chat-message', handleNewMessage);

    return () => {
      socket.emit('leave-chat-room', { appointmentId });
      socket.off('new-chat-message', handleNewMessage);
    };
  }, [appointmentId]);

  const fetchChatHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/consultations/chat/${appointmentId}`);
      if (res.data?.success) {
        setAppointment(res.data.data.appointment);
        setMessages(res.data.data.messages || []);
        setIsCancelled(Boolean(res.data.data.isCancelled));
        setIsPending(Boolean(res.data.data.isPending));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to access chat consultation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending || isCancelled || isPending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await apiClient.post(`/consultations/chat/${appointmentId}`, {
        message: text
      });

      if (res.data?.success) {
        const savedMsg = res.data.data;
        setMessages((prev) => {
          if (prev.some((m) => m._id === savedMsg._id)) return prev;
          return [...prev, savedMsg];
        });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  /**
   * Helper: Extract normalized sender ID from message object or reference
   */
  const getMessageSenderId = (msg) => {
    if (!msg) return '';
    const s = msg.sender ?? msg.user ?? msg.senderId;
    if (!s) return '';
    if (typeof s === 'object') {
      return (s._id || s.id)?.toString() || '';
    }
    return s.toString();
  };

  /**
   * CORE RULE:
   * Dynamic ownership test based on authenticated logged-in user's ID
   * vs message sender ID.
   */
  const isOwnMessage = (msg) => {
    if (!currentUserId) return false;
    const senderId = getMessageSenderId(msg);
    return Boolean(senderId && senderId.toLowerCase() === currentUserId.toLowerCase());
  };

  // Determine role perspective for header identity
  const isCurrentUserDoctor = Boolean(
    user?.role === 'doctor' ||
    (currentUserId && (appointment?.doctor?._id || appointment?.doctor)?.toString() === currentUserId)
  );

  const getOtherParticipantInfo = () => {
    if (!appointment) {
      return {
        name: 'Consultation Participant',
        subtitle: 'Healthcare Provider / Patient',
        avatar: 'U',
        isDoctor: false
      };
    }

    if (isCurrentUserDoctor) {
      // DOCTOR VIEW: other participant is the Patient
      const patient = appointment.patient || {};
      const name = patient.fullName || 'Patient';
      const avatar = name.charAt(0).toUpperCase() || 'P';

      let ageText = '';
      if (patient.dateOfBirth) {
        const diff = Date.now() - new Date(patient.dateOfBirth).getTime();
        const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        if (age >= 0 && age < 120) {
          ageText = `${age} yrs`;
        }
      }

      const genderText = patient.gender
        ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
        : '';

      const subtitleParts = ['Patient', ageText, genderText].filter(Boolean);
      const subtitle = subtitleParts.join(' • ');

      return {
        name,
        subtitle,
        avatar,
        isDoctor: false
      };
    } else {
      // PATIENT VIEW: other participant is the Doctor
      const doctor = appointment.doctor || {};
      const rawName = doctor.fullName || 'Doctor';
      const name = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`;
      const specialty = appointment.doctorProfile?.specialization || 'Specialist Doctor';
      const avatar = rawName.replace(/^Dr\.\s*/, '').charAt(0).toUpperCase() || 'D';

      return {
        name,
        subtitle: specialty,
        avatar,
        isDoctor: true
      };
    }
  };

  const other = getOtherParticipantInfo();
  const backLink = isCurrentUserDoctor ? '/doctor/appointments' : '/patient/appointments';

  if (loading || (authLoading && !user)) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-600">Connecting to secure consultation...</p>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Consultation Access Error</h2>
          <p className="text-xs text-slate-500">{error || 'Appointment not found or unauthorized.'}</p>
          <Link
            to={backLink}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Appointments</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <Link
            to={backLink}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
            title="Back to appointments"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-sm font-black shrink-0 shadow-2xs">
            {other.avatar}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 leading-tight">{other.name}</h2>
              {other.isDoctor && (
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" title="Verified Doctor" />
              )}
            </div>
            <p className="text-[11px] text-teal-700 font-semibold">{other.subtitle}</p>
          </div>
        </div>

        {/* Appointment Badge */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {new Date(appointment.date).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {appointment.timeSlot?.start} - {appointment.timeSlot?.end}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-bold uppercase text-[10px] border border-teal-200">
            {appointment.status}
          </span>
        </div>
      </header>

      {/* Cancellation / Rejection Banner */}
      {isCancelled && (
        <div className="bg-rose-50 border-b border-rose-200 p-3 px-6 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">
            This appointment has been cancelled, rejected, or declined. The messaging thread is archived in read-only mode.
          </span>
        </div>
      )}

      {/* Pending Doctor Action Banner */}
      {isPending && !isCancelled && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 px-6 text-amber-900 text-xs flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-semibold">
            This consultation is currently pending doctor review. Messaging will be enabled once Dr. {other.name} confirms the appointment.
          </span>
        </div>
      )}

      {/* Message Thread Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-1 max-w-4xl w-full mx-auto">
        {/* Initial Consultation Info Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 text-xs text-slate-600 space-y-1 text-center shadow-2xs mb-4">
          <div className="font-bold text-slate-800">
            Encrypted Consultation Session
          </div>
          <p className="text-[11px] text-slate-400">
            Messages exchanged here are confidential, secure, and stored in your medical history.
          </p>
          {appointment.reason && (
            <div className="pt-2 text-[11px] text-slate-700 font-medium">
              <span className="text-slate-400">Consultation Chief Complaint: </span>
              "{appointment.reason}"
            </div>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-16 text-xs text-slate-400">
            No messages sent yet. Start the consultation by saying hello!
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = isOwnMessage(msg);
            const senderId = getMessageSenderId(msg);
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

            const prevSenderId = getMessageSenderId(prevMsg);
            const nextSenderId = getMessageSenderId(nextMsg);

            const isFirstInGroup = index === 0 || prevSenderId !== senderId;
            const isLastInGroup = index === messages.length - 1 || nextSenderId !== senderId;

            const timeFormatted = msg.createdAt
              ? new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '';

            return (
              <div
                key={msg._id || index}
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${
                  isFirstInGroup ? 'mt-3.5' : 'mt-1'
                }`}
              >
                {/* LEFT SIDE: Other Participant */}
                {!isMe && (
                  <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
                    {/* Small avatar aligned at bottom of message group */}
                    {isLastInGroup ? (
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 border border-slate-300/80 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 mb-0.5 select-none shadow-2xs"
                        title={other.name}
                      >
                        {other.avatar}
                      </div>
                    ) : (
                      <div className="w-7 sm:w-8 shrink-0" aria-hidden="true" />
                    )}

                    {/* Left Bubble: Soft faded white/light grey, subtle border */}
                    <div className="bg-white border border-slate-200/90 text-slate-800 rounded-2xl rounded-bl-xs px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-2xs space-y-1">
                      {/* Optional Sender Name on first message of group */}
                      {isFirstInGroup && (
                        <p className="text-[11px] font-bold text-teal-800 leading-tight">
                          {other.name}
                        </p>
                      )}

                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.message}
                      </p>

                      {/* Timestamp (no checkmarks on left side) */}
                      <div className="flex items-center justify-end text-[10px] text-slate-400 font-medium select-none pt-0.5">
                        <span>{timeFormatted}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* RIGHT SIDE: Current Authenticated User */}
                {isMe && (
                  <div className="flex items-end justify-end gap-2 max-w-[85%] sm:max-w-[70%] ml-auto">
                    {/* Right Bubble: Soft faded teal/blue medical color, NOT oversaturated */}
                    <div className="bg-teal-50 border border-teal-200/80 text-slate-900 rounded-2xl rounded-br-xs px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-2xs space-y-1">
                      <p className="text-xs sm:text-sm text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.message}
                      </p>

                      {/* Timestamp & Sent/Read Checkmarks */}
                      <div className="flex items-center justify-end gap-1.5 text-[10px] text-teal-800/70 font-medium select-none pt-0.5">
                        <span>{timeFormatted}</span>
                        <span className="flex items-center">
                          {msg.isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-teal-600" title="Read" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400" title="Delivered" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar / Composer */}
      <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 shadow-xs z-10">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isCancelled
                ? 'Messaging disabled for cancelled or rejected appointment'
                : isPending
                ? 'Messaging will be enabled once appointment is confirmed'
                : 'Type your consultation message...'
            }
            disabled={isCancelled || isPending || sending}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending || isCancelled || isPending}
            className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatConsultationPage;
