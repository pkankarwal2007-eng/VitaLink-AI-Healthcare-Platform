const Appointment = require('../models/Appointment');
const ConsultationMessage = require('../models/ConsultationMessage');
const DoctorProfile = require('../models/DoctorProfile');
const User = require('../models/User');
const { getIO } = require('../services/socketService');
const { APPOINTMENT_STATUS, ROLES } = require('../config/constants');

/**
 * Get chat history for an authorized consultation appointment
 * GET /api/v1/consultations/chat/:appointmentId
 * Access: Authenticated (Appointment Patient or Doctor)
 */
const getChatMessages = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'fullName avatar email phone city state')
      .populate('doctorProfile', 'specialization hospitalName consultationFee')
      .populate('patient', 'fullName avatar email phone city state gender dateOfBirth');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Consultation appointment not found.'
      });
    }

    const isPatient = appointment.patient?._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor?._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this consultation.'
      });
    }

    // Retrieve all messages in chronological order
    const messages = await ConsultationMessage.find({
      appointment: appointment._id
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'fullName avatar role');

    // Automatically mark all unread messages received by current user as read
    await ConsultationMessage.updateMany(
      {
        appointment: appointment._id,
        receiver: req.user._id,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    const isCancelled = [
      APPOINTMENT_STATUS.CANCELLED,
      APPOINTMENT_STATUS.REJECTED,
      APPOINTMENT_STATUS.DECLINED
    ].includes(appointment.status);
    const isPending = [
      APPOINTMENT_STATUS.PENDING,
      APPOINTMENT_STATUS.SUGGESTED_TIME
    ].includes(appointment.status);
    const isConfirmed = appointment.status === APPOINTMENT_STATUS.CONFIRMED;

    res.status(200).json({
      success: true,
      data: {
        appointment,
        messages,
        isCancelled,
        isPending,
        isConfirmed
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a chat message in an authorized consultation appointment
 * POST /api/v1/consultations/chat/:appointmentId
 * Access: Authenticated (Appointment Patient or Doctor)
 */
const sendChatMessage = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { message, attachments = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Message content cannot be empty.'
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Message is too long (maximum 2000 characters).'
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Consultation appointment not found.'
      });
    }

    const isPatient = appointment.patient.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied: You are not a participant in this consultation.'
      });
    }

    // Guard: Only confirmed appointments allow sending chat messages
    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) {
      const isAwaiting = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.SUGGESTED_TIME].includes(appointment.status);
      const errorCode = isAwaiting
        ? 'APPOINTMENT_AWAITING_CONFIRMATION'
        : (appointment.status === APPOINTMENT_STATUS.CANCELLED ? 'CANNOT_CHAT_CANCELLED' : 'CANNOT_CHAT_INACTIVE');
      return res.status(400).json({
        success: false,
        code: errorCode,
        message: isAwaiting
          ? 'Messaging will be enabled once the appointment is confirmed by the doctor.'
          : 'Cannot send messages for a cancelled or rejected appointment.'
      });
    }

    // Determine receiver
    const receiverId = isPatient ? appointment.doctor : appointment.patient;

    const newMessage = await ConsultationMessage.create({
      appointment: appointment._id,
      sender: req.user._id,
      receiver: receiverId,
      message: message.trim(),
      attachments,
      isRead: false
    });

    await newMessage.populate('sender', 'fullName avatar role');

    // Broadcast in real time via Socket.IO
    const io = getIO();
    if (io) {
      // Emit to consultation room
      io.to(`chat:${appointment._id}`).emit('new-chat-message', newMessage);

      // Emit notification to receiver's personal room
      io.to(`user:${receiverId.toString()}`).emit('chat-notification', {
        appointmentId: appointment._id,
        senderId: req.user._id,
        senderName: req.user.fullName,
        messageSnippet: message.trim().slice(0, 60),
        createdAt: newMessage.createdAt
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: newMessage
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active chat conversations for the logged in user
 * GET /api/v1/consultations/conversations
 * Access: Authenticated (Patient or Doctor)
 */
const getMyConversations = async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === ROLES.PATIENT) {
      query.patient = req.user._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      query.doctor = req.user._id;
    } else {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied.'
      });
    }

    const appointments = await Appointment.find(query)
      .populate('doctor', 'fullName avatar email phone city')
      .populate('doctorProfile', 'specialization hospitalName')
      .populate('patient', 'fullName avatar email phone')
      .sort({ date: -1 })
      .lean();

    const conversationList = await Promise.all(
      appointments.map(async (apt) => {
        const lastMsg = await ConsultationMessage.findOne({ appointment: apt._id })
          .sort({ createdAt: -1 })
          .lean();

        const unreadCount = await ConsultationMessage.countDocuments({
          appointment: apt._id,
          receiver: req.user._id,
          isRead: false
        });

        return {
          appointment: apt,
          lastMessage: lastMsg || null,
          unreadCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: conversationList
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify and authorize access for private WebRTC video consultation room
 * GET /api/v1/consultations/video/:appointmentId/auth
 * Access: Authenticated (Appointment Patient or Doctor)
 */
const getVideoRoomAuth = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'fullName avatar email phone')
      .populate('doctorProfile', 'specialization hospitalName consultationFee')
      .populate('patient', 'fullName avatar email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    const isPatient = appointment.patient?._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor?._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this video consultation.'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED) {
      return res.status(400).json({
        success: false,
        code: 'APPOINTMENT_NOT_ACTIVE',
        message: 'Video consultation room is only accessible for confirmed appointments.'
      });
    }

    const peerObj = isPatient
      ? {
          id: appointment.doctor?._id,
          name: appointment.doctor?.fullName,
          avatar: appointment.doctor?.avatar,
          phone: appointment.doctor?.phone,
          specialization: appointment.doctorProfile?.specialization || 'Specialist',
          hospitalName: appointment.doctorProfile?.hospitalName
        }
      : {
          id: appointment.patient?._id,
          name: appointment.patient?.fullName,
          avatar: appointment.patient?.avatar,
          phone: appointment.patient?.phone
        };

    res.status(200).json({
      success: true,
      message: 'Video consultation room access authorized.',
      data: {
        appointmentId: appointment._id,
        videoRoomId: appointment.videoRoomId || `video:${appointment._id}`,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        date: appointment.date,
        timeSlot: appointment.timeSlot,
        consultationType: appointment.consultationType,
        reason: appointment.reason,
        status: appointment.status,
        doctor: {
          id: appointment.doctor?._id,
          name: appointment.doctor?.fullName,
          avatar: appointment.doctor?.avatar,
          phone: appointment.doctor?.phone,
          specialization: appointment.doctorProfile?.specialization || 'Specialist',
          hospitalName: appointment.doctorProfile?.hospitalName
        },
        patient: {
          id: appointment.patient?._id,
          name: appointment.patient?.fullName,
          avatar: appointment.patient?.avatar,
          phone: appointment.patient?.phone
        },
        peer: peerObj,
        consultationStartedAt: appointment.consultationStartedAt,
        consultationDuration: appointment.consultationDuration,
        userRole: isPatient ? 'patient' : (isDoctor ? 'doctor' : 'admin')
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record consultation session completion/end metadata
 * PATCH /api/v1/consultations/video/:appointmentId/end
 * Access: Authenticated (Appointment Patient or Doctor)
 */
const endConsultationSession = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { duration = 0, status = 'completed' } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    const isPatient = appointment.patient.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied.'
      });
    }

    const durationSec = Math.max(0, parseInt(duration, 10) || 0);
    const now = new Date();
    if (!appointment.consultationStartedAt && durationSec > 0) {
      appointment.consultationStartedAt = new Date(now.getTime() - durationSec * 1000);
    }
    appointment.consultationEndedAt = now;
    if (durationSec > (appointment.consultationDuration || 0)) {
      appointment.consultationDuration = durationSec;
    }
    appointment.lastConsultationStatus = status || 'COMPLETED';

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Consultation session record updated.',
      data: {
        appointmentId: appointment._id,
        duration: appointment.consultationDuration,
        consultationDuration: appointment.consultationDuration,
        startedAt: appointment.consultationStartedAt,
        endedAt: appointment.consultationEndedAt,
        status: appointment.lastConsultationStatus,
        lastConsultationStatus: appointment.lastConsultationStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get physical in-person consultation pass and hospital directions
 * GET /api/v1/consultations/physical/:appointmentId
 * Access: Authenticated (Appointment Patient or Doctor)
 */
const getPhysicalConsultationDetails = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'fullName avatar email phone city state')
      .populate('doctorProfile', 'specialization hospitalName hospitalAddress consultationFee')
      .populate('patient', 'fullName avatar email phone city state gender dateOfBirth');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    const isPatient = appointment.patient?._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor?._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this consultation.'
      });
    }

    const clinicAddress = appointment.doctorProfile?.hospitalAddress || `${appointment.doctor?.city || 'City'}, India`;
    const hospitalName = appointment.doctorProfile?.hospitalName || 'Affiliated Clinical Centre';

    res.status(200).json({
      success: true,
      data: {
        appointmentId: appointment._id,
        status: appointment.status,
        date: appointment.date,
        timeSlot: appointment.timeSlot,
        fee: appointment.fee,
        reason: appointment.reason,
        consultationType: appointment.consultationType,
        clinic: {
          hospitalName,
          address: clinicAddress,
          city: appointment.doctor?.city,
          state: appointment.doctor?.state
        },
        doctor: {
          name: appointment.doctor?.fullName,
          specialization: appointment.doctorProfile?.specialization || 'Practitioner',
          phone: appointment.doctor?.phone
        },
        patient: {
          name: appointment.patient?.fullName,
          phone: appointment.patient?.phone,
          gender: appointment.patient?.gender
        },
        instructions: [
          'Please arrive 15 minutes prior to your scheduled consultation slot.',
          'Bring a valid government-issued photo ID (Aadhaar, Passport, or Driving License).',
          'Bring previous physical prescriptions and diagnostic lab reports relevant to your visit.',
          'Check in at the reception desk presenting this digital consultation confirmation.'
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatMessages,
  sendChatMessage,
  getMyConversations,
  getVideoRoomAuth,
  endConsultationSession,
  getPhysicalConsultationDetails
};
