import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { getSocket } from '../../services/socket';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Settings,
  X,
  Send,
  User,
  ShieldCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
  ArrowLeft,
  RefreshCw,
  Volume2,
  Sparkles,
  Activity,
  Maximize,
  Minimize
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const VideoConsultationPage = () => {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Session & Auth
  const [authData, setAuthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Call & WebRTC Connection States
  const [connectionStatus, setConnectionStatus] = useState('Connecting securely...');
  const [connectionStateCode, setConnectionStateCode] = useState('connecting');
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(true);
  const [isRemoteAudioEnabled, setIsRemoteAudioEnabled] = useState(true);
  const [networkQuality, setNetworkQuality] = useState('Good');
  const [callDuration, setCallDuration] = useState(0);

  // Local Media Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [isAcquiringMedia, setIsAcquiringMedia] = useState(false);

  // Autoplay Unmute Banner
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  // Panels & Modals
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRecordsOpen, setIsRecordsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [consultationSummary, setConsultationSummary] = useState(null);

  // Devices
  const [availableDevices, setAvailableDevices] = useState({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');

  // Chat in consultation
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Patient Records Preview (Doctor View)
  const [patientRecords, setPatientRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // DOM & WebRTC Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const chatBottomRef = useRef(null);

  // -------------------------------------------------------------------
  // 1. Authenticate and Authorize Video Room
  // -------------------------------------------------------------------
  useEffect(() => {
    fetchSessionAuth();
  }, [appointmentId]);

  const fetchSessionAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await apiClient.get(`/consultations/video/${appointmentId}/auth`);
      if (res.data?.success) {
        setAuthData(res.data.data);
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Access denied to this video consultation.');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------
  // 2. Synthetic Stream Fallback Generator
  // -------------------------------------------------------------------
  const createSyntheticMediaStream = (name = 'User') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    let frame = 0;
    const draw = () => {
      frame++;
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      const pulse = Math.sin(frame * 0.05) * 4;
      ctx.beginPath();
      ctx.arc(320, 200, 70 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#0d9488';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.charAt(0).toUpperCase() || 'U', 320, 200);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(name, 320, 310);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('VitaLink Telemedicine • Audio-Only Mode', 320, 340);

      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(220, 390);
      ctx.lineTo(280, 390);
      ctx.lineTo(295, 370);
      ctx.lineTo(310, 410);
      ctx.lineTo(325, 360);
      ctx.lineTo(340, 390);
      ctx.lineTo(420, 390);
      ctx.stroke();

      requestAnimationFrame(draw);
    };
    draw();

    const videoStream = canvas.captureStream(25);
    const videoTrack = videoStream.getVideoTracks()[0];

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const dst = osc.connect(audioCtx.createMediaStreamDestination());
    osc.start();
    const audioTrack = dst.stream.getAudioTracks()[0];
    audioTrack.enabled = false;

    return new MediaStream([videoTrack, audioTrack]);
  };

  // -------------------------------------------------------------------
  // 3. Acquire Local Media with Fallbacks
  // -------------------------------------------------------------------
  const acquireLocalMedia = useCallback(async (preferredAudioId = '', preferredVideoId = '') => {
    setIsAcquiringMedia(true);
    setPermissionError(null);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    const videoConstraint = preferredVideoId
      ? { deviceId: { exact: preferredVideoId } }
      : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };

    const audioConstraint = preferredAudioId
      ? { deviceId: { exact: preferredAudioId } }
      : { echoCancellation: true, noiseSuppression: true };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint
      });

      localStreamRef.current = stream;
      setIsAudioOnly(false);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsAcquiringMedia(false);
      return stream;
    } catch (err) {
      console.warn('[VitaLink WebRTC] Standard getUserMedia failed:', err.name, err.message);

      const isBlocked = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const isNotFound = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraint,
          video: false
        });

        const synthetic = createSyntheticMediaStream(user?.fullName || 'You');
        const syntheticVideoTrack = synthetic.getVideoTracks()[0];
        const combined = new MediaStream([syntheticVideoTrack, ...audioStream.getAudioTracks()]);

        localStreamRef.current = combined;
        setIsAudioOnly(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = combined;
        }

        setPermissionError({
          type: 'camera_fallback',
          message: isNotFound
            ? 'No physical camera detected. Switched to Audio-Only consultation.'
            : isBlocked
            ? 'Camera access was blocked in browser. Continuing in Audio-Only mode.'
            : 'Camera is currently in use by another app. Continuing in Audio-Only mode.',
          details: 'Microphone is active. You can proceed with the consultation.'
        });

        setIsAcquiringMedia(false);
        return combined;
      } catch (audioErr) {
        console.warn('[VitaLink WebRTC] Audio-only fallback also failed:', audioErr.name);

        const synthetic = createSyntheticMediaStream(user?.fullName || 'You');
        localStreamRef.current = synthetic;
        setIsAudioOnly(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = synthetic;
        }

        setPermissionError({
          type: 'permission_denied',
          message: isBlocked
            ? 'Microphone and Camera permissions are blocked.'
            : 'Audio/Video devices are currently unavailable or not detected.',
          details: 'Please click the lock/camera icon in your browser address bar and select "Allow".'
        });

        setIsAcquiringMedia(false);
        return synthetic;
      }
    }
  }, [user?.fullName]);

  // Enumerate Devices
  const updateDeviceList = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices({
        audioInputs: devices.filter((d) => d.kind === 'audioinput'),
        videoInputs: devices.filter((d) => d.kind === 'videoinput'),
        audioOutputs: devices.filter((d) => d.kind === 'audiooutput')
      });
    } catch (e) {
      console.warn('Could not enumerate devices:', e);
    }
  };

  // -------------------------------------------------------------------
  // 4. WebRTC Connection & Signaling Engine
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!authData) return;

    let socket = getSocket();
    let pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    iceCandidateQueueRef.current = [];

    const attachLocalTracks = (stream) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      });
    };

    const initCall = async () => {
      const stream = await acquireLocalMedia(selectedAudioInput, selectedVideoInput);
      attachLocalTracks(stream);
      await updateDeviceList();

      setConnectionStatus('Joining consultation room...');
      setConnectionStateCode('connecting');

      socket.emit('join-video-room', { appointmentId }, (res) => {
        if (!res?.success) {
          setConnectionStatus(res?.error || 'Unable to join video consultation room.');
          setConnectionStateCode('failed');
          return;
        }

        socket.emit('client-ready', { appointmentId });

        if (res.participantCount > 1) {
          setConnectionStatus('Other participant present. Establishing secure WebRTC connection...');
          setConnectionStateCode('connecting');
        } else {
          const otherTitle = user?.role === 'patient' ? `Dr. ${authData.doctor?.name}` : authData.patient?.name;
          setConnectionStatus(`Waiting for ${otherTitle} to join...`);
          setConnectionStateCode('waiting');
        }
      });
    };

    initCall();

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsPeerConnected(true);
        setConnectionStatus('Connected • Private Clinical Consultation');
        setConnectionStateCode('connected');

        remoteVideoRef.current
          .play()
          .then(() => setNeedsAudioUnlock(false))
          .catch((e) => {
            console.warn('[VitaLink WebRTC] Autoplay requires user interaction:', e);
            setNeedsAudioUnlock(true);
          });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          appointmentId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setIsPeerConnected(true);
        setConnectionStatus('Connected • Private Clinical Consultation');
        setConnectionStateCode('connected');
        setNetworkQuality('Excellent');
      } else if (state === 'connecting') {
        setConnectionStatus('Connecting securely...');
        setConnectionStateCode('connecting');
      } else if (state === 'disconnected') {
        setIsPeerConnected(false);
        setConnectionStatus('Connection interrupted. Reconnecting...');
        setConnectionStateCode('reconnecting');
        setNetworkQuality('Poor');
      } else if (state === 'failed') {
        setIsPeerConnected(false);
        setConnectionStatus('Unable to establish video connection. Checking network...');
        setConnectionStateCode('failed');
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        setIsPeerConnected(true);
        setConnectionStateCode('connected');
      } else if (iceState === 'disconnected') {
        setConnectionStateCode('reconnecting');
      } else if (iceState === 'failed') {
        if (pc.restartIce) pc.restartIce();
      }
    };

    socket.on('user-joined', (peer) => {
      setConnectionStatus(`${peer.fullName} joined. Preparing connection...`);
      setConnectionStateCode('connecting');
      socket.emit('client-ready', { appointmentId });
    });

    socket.on('peer-ready', async () => {
      try {
        setConnectionStatus('Connecting to participant...');
        setConnectionStateCode('connecting');

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { appointmentId, sdp: offer });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
      }
    });

    socket.on('webrtc-offer', async ({ sdp }) => {
      try {
        setConnectionStatus('Received consultation call. Connecting...');
        setConnectionStateCode('connecting');

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        while (iceCandidateQueueRef.current.length > 0) {
          const cand = iceCandidateQueueRef.current.shift();
          await pc.addIceCandidate(cand).catch(console.warn);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { appointmentId, sdp: answer });
      } catch (err) {
        console.error('Error answering WebRTC offer:', err);
      }
    });

    socket.on('webrtc-answer', async ({ sdp }) => {
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          while (iceCandidateQueueRef.current.length > 0) {
            const cand = iceCandidateQueueRef.current.shift();
            await pc.addIceCandidate(cand).catch(console.warn);
          }
        }
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      try {
        if (!candidate) return;
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidateQueueRef.current.push(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    socket.on('peer-toggle-media', ({ type, enabled }) => {
      if (type === 'video') {
        setIsRemoteVideoEnabled(enabled);
      } else if (type === 'audio') {
        setIsRemoteAudioEnabled(enabled);
      }
    });

    socket.on('user-left', () => {
      setIsPeerConnected(false);
      const otherTitle = user?.role === 'patient' ? `Dr. ${authData.doctor?.name}` : authData.patient?.name;
      setConnectionStatus(`${otherTitle} has left the consultation.`);
      setConnectionStateCode('disconnected');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    socket.on('call-ended', ({ endedByName, duration }) => {
      handleConsultationEndedByPeer(endedByName, duration);
    });

    return () => {
      socket.emit('leave-video-room', { appointmentId });
      socket.off('user-joined');
      socket.off('peer-ready');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('peer-toggle-media');
      socket.off('user-left');
      socket.off('call-ended');

      if (timerRef.current) clearInterval(timerRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [authData, appointmentId, acquireLocalMedia, user?.role, selectedAudioInput, selectedVideoInput]);

  // -------------------------------------------------------------------
  // 5. Call Timer (Starts strictly when connected)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (isPeerConnected) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current && connectionStateCode === 'disconnected') {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isPeerConnected, connectionStateCode]);

  // -------------------------------------------------------------------
  // 6. Media Controls (Mic, Camera, Screen Share)
  // -------------------------------------------------------------------
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newState = !audioTrack.enabled;
        setIsMuted(newState);

        const socket = getSocket();
        socket.emit('peer-toggle-media', {
          appointmentId,
          type: 'audio',
          enabled: !newState
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newState = !videoTrack.enabled;
        setIsVideoOff(newState);

        const socket = getSocket();
        socket.emit('peer-toggle-media', {
          appointmentId,
          type: 'video',
          enabled: !newState
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      if (cameraTrack) {
        const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  const handleDeviceChange = async (kind, deviceId) => {
    if (kind === 'audioinput') {
      setSelectedAudioInput(deviceId);
      await acquireLocalMedia(deviceId, selectedVideoInput);
    } else if (kind === 'videoinput') {
      setSelectedVideoInput(deviceId);
      await acquireLocalMedia(selectedAudioInput, deviceId);
    } else if (kind === 'audiooutput' && remoteVideoRef.current?.setSinkId) {
      try {
        await remoteVideoRef.current.setSinkId(deviceId);
      } catch (e) {
        console.warn('Cannot set audio sink:', e);
      }
    }
  };

  const handleUnlockAudio = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.play().then(() => setNeedsAudioUnlock(false));
    }
  };

  // -------------------------------------------------------------------
  // 7. Consultation Chat Integration
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isChatOpen) return;
    loadChatMessages();

    const socket = getSocket();
    socket.emit('join-chat-room', { appointmentId });

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    socket.on('new-chat-message', handleNewMessage);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
    };
  }, [isChatOpen, appointmentId]);

  const loadChatMessages = async () => {
    try {
      const res = await apiClient.get(`/consultations/chat/${appointmentId}`);
      if (res.data?.success) {
        setMessages(res.data.data?.messages || []);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) {
      console.warn('Could not load chat messages:', e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingMsg) return;

    setSendingMsg(true);
    try {
      const res = await apiClient.post(`/consultations/chat/${appointmentId}`, {
        message: chatInput.trim()
      });
      if (res.data?.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setChatInput('');
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSendingMsg(false);
    }
  };

  // -------------------------------------------------------------------
  // 8. Patient Records Preview for Doctor
  // -------------------------------------------------------------------
  useEffect(() => {
    if (isRecordsOpen && user?.role === 'doctor' && authData?.patient?.id) {
      loadPatientRecords();
    }
  }, [isRecordsOpen, user?.role, authData?.patient?.id]);

  const loadPatientRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await apiClient.get(`/medical/records?patientId=${authData.patient.id}`);
      if (res.data?.success) {
        setPatientRecords(res.data.data || []);
      }
    } catch (e) {
      console.warn('Could not fetch patient records:', e);
    } finally {
      setLoadingRecords(false);
    }
  };

  // -------------------------------------------------------------------
  // 9. Leave Consultation & Summary
  // -------------------------------------------------------------------
  const confirmLeaveConsultation = async () => {
    setShowLeaveConfirm(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const socket = getSocket();
    socket.emit('end-consultation', { appointmentId, duration: callDuration });
    socket.emit('leave-video-room', { appointmentId });

    try {
      await apiClient.patch(`/consultations/video/${appointmentId}/end`, {
        duration: callDuration,
        status: 'completed'
      });
    } catch (e) {
      console.warn('Could not save consultation end record:', e);
    }

    setConsultationSummary({
      doctorName: authData?.doctor?.name,
      patientName: authData?.patient?.name,
      specialization: authData?.doctor?.specialization,
      date: authData?.date,
      timeSlot: authData?.timeSlot,
      duration: callDuration,
      status: 'Consultation Completed'
    });
  };

  const handleConsultationEndedByPeer = (endedByName, duration) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setConsultationSummary({
      doctorName: authData?.doctor?.name,
      patientName: authData?.patient?.name,
      specialization: authData?.doctor?.specialization,
      date: authData?.date,
      timeSlot: authData?.timeSlot,
      duration: duration || callDuration,
      status: `Consultation ended by ${endedByName || 'participant'}`
    });
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const remaining = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${remaining}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border-2 border-teal-500/40 flex items-center justify-center animate-pulse">
            <Video className="w-8 h-8 text-teal-400" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-teal-500/20 blur-sm -z-10 animate-pulse" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-sm font-bold text-slate-200">Authenticating Consultation Session</h2>
          <p className="text-xs text-slate-400">Verifying medical appointment authorization & WebRTC signaling...</p>
        </div>
      </div>
    );
  }

  if (authError || !authData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-black">Video Room Authorization Failed</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {authError || 'You are not authorized to join this consultation or the appointment is not currently confirmed.'}
          </p>
          <div className="pt-2">
            <Link
              to={user?.role === 'doctor' ? '/doctor/appointments' : '/patient/appointments'}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Appointments</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (consultationSummary) {
    const isDoctor = user?.role === 'doctor';
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-white">Consultation Completed</h2>
            <p className="text-xs text-slate-400">
              {consultationSummary.status} • Private & Secure WebRTC Session
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Doctor</span>
              <span className="font-bold text-white">Dr. {consultationSummary.doctorName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Patient</span>
              <span className="font-bold text-white">{consultationSummary.patientName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Scheduled Time</span>
              <span className="font-semibold text-slate-200">
                {consultationSummary.timeSlot?.start} - {consultationSummary.timeSlot?.end}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-700/40">
              <span className="text-slate-400">Call Duration</span>
              <span className="font-black text-teal-400">{formatTime(consultationSummary.duration)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Recording Policy</span>
              <span className="text-[11px] font-semibold text-slate-400">Not recorded (Patient Privacy)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {isDoctor ? (
              <Link
                to={`/doctor/prescriptions?appointmentId=${appointmentId}`}
                className="flex-1 px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs text-center flex items-center justify-center gap-2 shadow-md transition"
              >
                <FileText className="w-4 h-4" />
                <span>Issue Prescription</span>
              </Link>
            ) : (
              <Link
                to="/patient/prescriptions"
                className="flex-1 px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs text-center flex items-center justify-center gap-2 shadow-md transition"
              >
                <FileText className="w-4 h-4" />
                <span>View Prescriptions</span>
              </Link>
            )}
            <Link
              to={isDoctor ? '/doctor/appointments' : '/patient/appointments'}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs text-center transition"
            >
              Return to Appointments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isDoctorUser = user?.role === 'doctor';
  const remoteParticipantName = isDoctorUser ? authData.patient?.name : `Dr. ${authData.doctor?.name}`;
  const remoteRoleLabel = isDoctorUser ? 'Patient' : authData.doctor?.specialization || 'Doctor';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col h-screen overflow-hidden select-none font-sans">
      {/* 1. TOP CLINICAL HEADER BAR */}
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-sm shadow-inner">
            {remoteParticipantName?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
              <span>{remoteParticipantName}</span>
              <ShieldCheck className="w-4 h-4 text-teal-400" />
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400">
              {remoteRoleLabel} • {authData.timeSlot?.start} - {authData.timeSlot?.end} • End-to-End Encrypted
            </p>
          </div>
        </div>

        {/* Center: Timer & Live Connection Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold shadow-inner">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>{formatTime(callDuration)}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStateCode === 'connected'
                  ? 'bg-teal-400 animate-pulse'
                  : connectionStateCode === 'waiting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-400'
              }`}
            />
            <span className="font-semibold">{connectionStatus}</span>
          </div>

          {/* Quick Header Toggles */}
          <div className="flex items-center gap-1.5">
            {isDoctorUser && (
              <button
                onClick={() => {
                  setIsRecordsOpen(!isRecordsOpen);
                  setIsChatOpen(false);
                }}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                  isRecordsOpen
                    ? 'bg-teal-600 text-white border-teal-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Patient Medical Records"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden lg:inline">Records</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsChatOpen(!isChatOpen);
                setIsRecordsOpen(false);
              }}
              className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 relative ${
                isChatOpen
                  ? 'bg-teal-600 text-white border-teal-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Consultation Chat"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden lg:inline">Chat</span>
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 text-slate-950 rounded-full text-[9px] font-black flex items-center justify-center">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
              title="Audio/Video Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE: VIDEO WORK AREA + DRAWERS */}
      <div className="flex-1 relative bg-slate-950 flex overflow-hidden">
        {/* Permission Alert Banner (if any) */}
        {permissionError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[92%] bg-amber-900/90 backdrop-blur-md border border-amber-600/60 rounded-2xl p-3 px-4 shadow-xl flex items-center justify-between gap-3 text-xs text-amber-100 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-amber-200">{permissionError.message}</p>
                <p className="text-[11px] text-amber-300/80">{permissionError.details}</p>
              </div>
            </div>
            <button
              onClick={() => acquireLocalMedia(selectedAudioInput, selectedVideoInput)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAcquiringMedia ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Autoplay Unlock Banner */}
        {needsAudioUnlock && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-teal-900/90 backdrop-blur-md border border-teal-500 rounded-2xl p-3 px-4 shadow-xl flex items-center gap-3 text-xs text-teal-100">
            <Volume2 className="w-5 h-5 text-teal-400 shrink-0 animate-bounce" />
            <span>Audio paused by browser security. Click to enable participant sound.</span>
            <button
              onClick={handleUnlockAudio}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px]"
            >
              Enable Sound
            </button>
          </div>
        )}

        {/* Main Remote Video Screen */}
        <div className="flex-1 relative flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <div className="w-full h-full max-w-6xl rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 flex items-center justify-center relative shadow-2xl">
            {/* Live WebRTC Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isPeerConnected && isRemoteVideoEnabled ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />

            {/* Remote Video Fallback Card */}
            {(!isPeerConnected || !isRemoteVideoEnabled) && (
              <div className="text-center space-y-4 p-6 max-w-md animate-in fade-in">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-3xl bg-slate-800 text-teal-400 flex items-center justify-center mx-auto text-3xl font-black border-2 border-slate-700 shadow-xl">
                    {remoteParticipantName?.charAt(0) || 'U'}
                  </div>
                  {connectionStateCode === 'waiting' && (
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-xs font-bold animate-ping" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-100">{remoteParticipantName}</h3>
                  <p className="text-xs text-slate-400">{remoteRoleLabel}</p>
                </div>

                <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-xs text-slate-300">
                  {connectionStateCode === 'waiting' ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-400">Waiting for participant to enter...</p>
                      <p className="text-[11px] text-slate-400">
                        Consultation slot: {authData.timeSlot?.start} - {authData.timeSlot?.end}. Both participants must join this room.
                      </p>
                    </div>
                  ) : connectionStateCode === 'connecting' ? (
                    <p className="font-semibold text-teal-400 animate-pulse">Establishing peer-to-peer connection...</p>
                  ) : !isRemoteVideoEnabled ? (
                    <p className="font-semibold text-slate-300">Participant has turned off their camera.</p>
                  ) : (
                    <p className="font-semibold text-slate-400">{connectionStatus}</p>
                  )}
                </div>

                {/* Remote Audio Mute Badge */}
                {!isRemoteAudioEnabled && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30">
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Participant Muted</span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom-left Remote Video Tag */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[11px] font-bold text-slate-200">
                {remoteParticipantName}
              </span>
              {!isRemoteAudioEnabled && (
                <span className="p-1.5 rounded-xl bg-rose-600/90 text-white text-[10px] font-bold">
                  <MicOff className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            {/* Floating Picture-in-Picture Local Video ("You") */}
            <div className="absolute bottom-4 right-4 w-40 sm:w-56 aspect-video rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700/80 shadow-2xl z-20 group">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover scale-x-[-1] ${
                  isVideoOff || isAudioOnly ? 'hidden' : 'block'
                }`}
              />

              {/* Camera Off / Audio Only Avatar */}
              {(isVideoOff || isAudioOnly) && (
                <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-slate-400 p-2 space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-black">
                    {user?.fullName?.charAt(0) || 'Y'}
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">
                    {isAudioOnly ? 'Audio Only' : 'Camera Off'}
                  </span>
                </div>
              )}

              {/* Local Video Overlay Badges */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                <span className="text-[10px] font-bold bg-slate-900/90 px-2 py-0.5 rounded-lg text-slate-200 border border-slate-700/60">
                  You
                </span>
                {isMuted && (
                  <span className="p-1 rounded-lg bg-rose-600 text-white text-[9px]">
                    <MicOff className="w-3 h-3" />
                  </span>
                )}
                {isScreenSharing && (
                  <span className="p-1 rounded-lg bg-teal-600 text-white text-[9px]" title="Screen Sharing Active">
                    <Monitor className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. SLIDING DRAWER: IN-CALL CONSULTATION CHAT */}
        {isChatOpen && (
          <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-black text-white">Consultation Chat</h3>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages List (WhatsApp Style: User -> Right, Peer -> Left) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2 p-4">
                  <MessageSquare className="w-8 h-8 text-slate-600" />
                  <p className="text-xs font-semibold">No messages yet</p>
                  <p className="text-[11px]">Send clinical notes or quick inquiries directly during the call.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                  return (
                    <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-xs ${
                          isMe
                            ? 'bg-teal-600 text-white rounded-tr-xs'
                            : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-tl-xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      </div>
                      <span className="text-[9px] text-slate-500 mt-1 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a clinical message..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={sendingMsg || !chatInput.trim()}
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </aside>
        )}

        {/* 4. SLIDING DRAWER: PATIENT MEDICAL RECORDS (DOCTOR VIEW) */}
        {isRecordsOpen && isDoctorUser && (
          <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-black text-white">Patient Clinical Profile</h3>
              </div>
              <button
                onClick={() => setIsRecordsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Patient Basic Card */}
              <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Patient Details</span>
                <p className="font-bold text-white text-sm">{authData.patient?.name}</p>
                <p className="text-slate-400 text-[11px]">{authData.patient?.phone}</p>
                <p className="text-slate-300 text-[11px] pt-1">
                  <span className="font-semibold text-slate-400">Chief Complaint: </span>
                  {authData.reason}
                </p>
              </div>

              {/* Quick Action: Issue Prescription */}
              <div className="p-3.5 bg-teal-950/40 border border-teal-500/30 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Clinical Actions</span>
                <p className="text-[11px] text-slate-300">Prepare medication or diagnostic tests for this consultation:</p>
                <Link
                  to={`/doctor/prescriptions?appointmentId=${appointmentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Prescription Pad ↗</span>
                </Link>
              </div>

              {/* Past Medical Records */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Previous Records</span>
                {loadingRecords ? (
                  <p className="text-slate-500 italic text-[11px]">Loading clinical history...</p>
                ) : patientRecords.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px]">No previous medical records found for this patient.</p>
                ) : (
                  patientRecords.map((r) => (
                    <div key={r._id} className="p-2.5 bg-slate-800 rounded-xl border border-slate-700/60 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-[11px]">{r.title}</span>
                        <span className="text-[9px] text-slate-400">{new Date(r.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2">{r.description || r.summary}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* 5. BOTTOM CLINICAL MEDIA CONTROLS BAR */}
      <footer className="h-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Device Info / Screen Share Indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-teal-400" />
          <span>WebRTC STUN Active</span>
          {isAudioOnly && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
              Audio-Only
            </span>
          )}
        </div>

        {/* Center: Main Media Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Microphone Toggle */}
          <button
            onClick={toggleMic}
            className={`p-3 sm:p-3.5 rounded-2xl font-bold transition flex items-center gap-2 shadow-md ${
              isMuted
                ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-500/40'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="hidden md:inline text-xs">{isMuted ? 'Muted' : 'Mute'}</span>
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleVideo}
            className={`p-3 sm:p-3.5 rounded-2xl font-bold transition flex items-center gap-2 shadow-md ${
              isVideoOff
                ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-500/40'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
            }`}
            title={isVideoOff ? 'Start Camera' : 'Stop Camera'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            <span className="hidden md:inline text-xs">{isVideoOff ? 'Camera Off' : 'Stop Video'}</span>
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 sm:p-3.5 rounded-2xl font-bold transition flex items-center gap-2 shadow-md ${
              isScreenSharing
                ? 'bg-teal-600 text-white hover:bg-teal-700 ring-2 ring-teal-500/40'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
            }`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            <span className="hidden md:inline text-xs">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
          </button>

          {/* Leave Consultation */}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="p-3 sm:p-3.5 px-5 sm:px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-lg transition ring-2 ring-rose-500/30"
          >
            <PhoneOff className="w-5 h-5" />
            <span>Leave</span>
          </button>
        </div>

        {/* Right: Quick Chat Toggle (Mobile) */}
        <div className="flex sm:hidden items-center">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="p-3 rounded-2xl bg-slate-800 text-slate-200 border border-slate-700"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* 6. MODAL: DEVICE SETTINGS */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-black text-white">Audio & Video Devices</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Microphone Select */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-teal-400" />
                  <span>Microphone</span>
                </label>
                <select
                  value={selectedAudioInput}
                  onChange={(e) => handleDeviceChange('audioinput', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="">Default Microphone</option>
                  {availableDevices.audioInputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Select */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-teal-400" />
                  <span>Camera</span>
                </label>
                <select
                  value={selectedVideoInput}
                  onChange={(e) => handleDeviceChange('videoinput', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="">Default Camera</option>
                  {availableDevices.videoInputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speaker Select (if supported) */}
              {availableDevices.audioOutputs.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Speaker / Output</span>
                  </label>
                  <select
                    onChange={(e) => handleDeviceChange('audiooutput', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Default Speaker</option>
                    {availableDevices.audioOutputs.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Speaker ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Connection Quality: {networkQuality}</p>
                <p>WebRTC ICE State: {connectionStateCode}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: LEAVE CONSULTATION CONFIRMATION */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <PhoneOff className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">Leave Consultation?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to end this video call? You will be able to review your consultation summary and issue prescriptions.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveConsultation}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md"
              >
                Yes, Leave Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoConsultationPage;
