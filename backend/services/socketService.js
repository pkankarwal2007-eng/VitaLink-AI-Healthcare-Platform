const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

let io = null;

/**
 * Initialize Socket.IO with HTTP server and authentication handshake
 * @param {object} httpServer - Node.js HTTP Server instance
 */
const initSocket = (httpServer) => {
  const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin === allowedOrigin || origin.startsWith('http://localhost:')) {
          return callback(null, true);
        }
        return callback(new Error('CORS not allowed for this origin: ' + origin));
      },
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        return next(new Error('Socket authentication error: Token required.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) {
        return next(new Error('Socket authentication error: User not active or not found.'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Socket authentication error: Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Join user to their personal notification channel
    socket.join(`user:${userId}`);

    // ----------------------------------------------------
    // 1. Chat Consultation Signaling
    // ----------------------------------------------------
    socket.on('join-chat-room', async ({ appointmentId }, callback) => {
      try {
        if (!appointmentId) {
          if (callback) callback({ success: false, error: 'Appointment ID required.' });
          return;
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
          if (callback) callback({ success: false, error: 'Appointment not found.' });
          return;
        }

        // Verify user is authorized participant
        const isPatient = appointment.patient.toString() === userId;
        const isDoctor = appointment.doctor.toString() === userId;

        if (!isPatient && !isDoctor && socket.user.role !== 'admin') {
          if (callback) callback({ success: false, error: 'Unauthorized to join this chat consultation.' });
          return;
        }

        socket.join(`chat:${appointmentId}`);
        if (callback) callback({ success: true, room: `chat:${appointmentId}` });
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('leave-chat-room', ({ appointmentId }) => {
      if (appointmentId) {
        socket.leave(`chat:${appointmentId}`);
      }
    });

    // Helper to resolve appointment ID from appointmentId or roomId
    const resolveApptId = (data) => {
      if (!data) return null;
      if (data.appointmentId) return String(data.appointmentId);
      if (data.roomId) {
        return String(data.roomId).startsWith('video:') ? String(data.roomId).replace('video:', '') : String(data.roomId);
      }
      return null;
    };

    // ----------------------------------------------------
    // 2. WebRTC Video Consultation Signaling
    // ----------------------------------------------------
    socket.on('join-video-room', async (payload, callback) => {
      try {
        const appointmentId = resolveApptId(payload);
        if (!appointmentId) {
          if (callback) callback({ success: false, error: 'Appointment ID required.' });
          return;
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
          if (callback) callback({ success: false, error: 'Appointment not found.' });
          return;
        }

        if (appointment.status === 'cancelled' || appointment.status === 'rejected') {
          if (callback) callback({ success: false, error: 'Cannot join video consultation for an inactive appointment.' });
          return;
        }

        const isPatient = appointment.patient.toString() === userId;
        const isDoctor = appointment.doctor.toString() === userId;

        if (!isPatient && !isDoctor && socket.user.role !== 'admin') {
          if (callback) callback({ success: false, error: 'Unauthorized to join this video consultation.' });
          return;
        }

        const roomName = `video:${appointmentId}`;
        socket.join(roomName);

        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        const participantCount = roomSockets ? roomSockets.size : 1;

        // Notify other peer in the room that a user has joined
        socket.to(roomName).emit('user-joined', {
          userId,
          fullName: socket.user.fullName,
          role: socket.user.role,
          participantCount
        });

        if (callback) {
          callback({
            success: true,
            room: roomName,
            participantCount,
            isInitiator: participantCount > 1
          });
        }
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    const isInVideoRoom = (appointmentId) => {
      if (!appointmentId) return false;
      return socket.rooms.has(`video:${appointmentId}`);
    };

    socket.on('client-ready', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && isInVideoRoom(appointmentId)) {
        socket.to(`video:${appointmentId}`).emit('peer-ready', {
          userId,
          fullName: socket.user.fullName,
          role: socket.user.role
        });
      }
    });

    socket.on('peer-toggle-media', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && isInVideoRoom(appointmentId)) {
        socket.to(`video:${appointmentId}`).emit('peer-toggle-media', {
          userId,
          type: payload?.type,
          enabled: payload?.enabled !== undefined ? Boolean(payload.enabled) : undefined,
          audio: payload?.audio,
          video: payload?.video
        });
      }
    });

    socket.on('webrtc-offer', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && payload?.sdp && isInVideoRoom(appointmentId)) {
        socket.to(`video:${appointmentId}`).emit('webrtc-offer', {
          sdp: payload.sdp,
          senderId: userId,
          fromUserId: userId
        });
      }
    });

    socket.on('webrtc-answer', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && payload?.sdp && isInVideoRoom(appointmentId)) {
        socket.to(`video:${appointmentId}`).emit('webrtc-answer', {
          sdp: payload.sdp,
          senderId: userId,
          fromUserId: userId
        });
      }
    });

    socket.on('webrtc-ice-candidate', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && payload?.candidate && isInVideoRoom(appointmentId)) {
        socket.to(`video:${appointmentId}`).emit('webrtc-ice-candidate', {
          candidate: payload.candidate,
          senderId: userId,
          fromUserId: userId
        });
      }
    });

    socket.on('send-video-message', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && payload?.message && isInVideoRoom(appointmentId)) {
        io.to(`video:${appointmentId}`).emit('receive-video-message', {
          senderId: userId,
          senderName: socket.user.fullName,
          senderRole: socket.user.role,
          message: payload.message,
          timestamp: new Date()
        });
      }
    });

    socket.on('end-consultation', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId && isInVideoRoom(appointmentId)) {
        socket.to(`video:${appointmentId}`).emit('call-ended', {
          endedBy: userId,
          endedByName: socket.user.fullName,
          duration: payload?.duration || 0
        });
      }
    });

    socket.on('leave-video-room', (payload) => {
      const appointmentId = resolveApptId(payload);
      if (appointmentId) {
        const roomName = `video:${appointmentId}`;
        socket.leave(roomName);
        socket.to(roomName).emit('user-left', { userId, reason: 'left' });
      }
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('video:')) {
          socket.to(room).emit('user-left', { userId, reason: 'disconnected' });
        }
      }
    });

    socket.on('disconnect', () => {
      // Cleaned up
    });
  });

  return io;
};

/**
 * Get active Socket.IO instance
 */
const getIO = () => {
  return io;
};

module.exports = {
  initSocket,
  getIO
};
