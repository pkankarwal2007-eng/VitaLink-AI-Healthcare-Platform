const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');
const User = require('../models/User');
const { APPOINTMENT_TYPES, APPOINTMENT_STATUS, ROLES } = require('../config/constants');
const { createNotification } = require('../services/notificationService');
const slotService = require('../services/slotService');

/**
 * Book a new consultation appointment
 * POST /api/v1/appointments
 * Access: Patient
 */
const bookAppointment = async (req, res, next) => {
  try {
    const {
      doctorId,
      date,
      timeSlot,
      consultationType = APPOINTMENT_TYPES.VIDEO,
      reason,
      notes = ''
    } = req.body;

    // Validate required fields
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Doctor ID is required.'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Appointment date is required.'
      });
    }

    if (!timeSlot || !timeSlot.start || !timeSlot.end) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Time slot with start and end times is required.'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Reason for consultation is required (minimum 3 characters).'
      });
    }

    // Validate consultation type
    const validTypes = Object.values(APPOINTMENT_TYPES);
    if (!validTypes.includes(consultationType)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: `Invalid consultation type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Lookup doctor profile (supports DoctorProfile _id or User _id)
    let doctorProfile = await DoctorProfile.findOne({
      _id: doctorId,
      isVerified: true,
      verificationStatus: 'approved'
    }).populate('user', 'fullName email phone isActive');

    if (!doctorProfile) {
      doctorProfile = await DoctorProfile.findOne({
        user: doctorId,
        isVerified: true,
        verificationStatus: 'approved'
      }).populate('user', 'fullName email phone isActive');
    }

    if (!doctorProfile || !doctorProfile.user || !doctorProfile.user.isActive) {
      return res.status(404).json({
        success: false,
        code: 'DOCTOR_NOT_FOUND',
        message: 'Doctor is not verified or currently active for appointments.'
      });
    }

    const doctorUserId = doctorProfile.user._id;

    // Prevent doctor booking appointment with themselves
    if (doctorUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        code: 'SELF_BOOKING_NOT_ALLOWED',
        message: 'Doctors cannot book appointments with themselves.'
      });
    }

    // Validate consultation mode is supported by doctor
    const supportedModes = doctorProfile.consultationModes || ['chat', 'video', 'physical'];
    if (!supportedModes.includes(consultationType)) {
      return res.status(400).json({
        success: false,
        code: 'MODE_NOT_SUPPORTED',
        message: `This doctor does not offer ${consultationType} consultations.`
      });
    }

    // Parse and validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_DATE',
        message: 'Invalid appointment date format.'
      });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

    if (targetDayStart < todayStart) {
      return res.status(400).json({
        success: false,
        code: 'PAST_DATE_NOT_ALLOWED',
        message: 'Cannot schedule appointments in the past.'
      });
    }

    // If booking for today, verify slot has not already passed
    if (targetDayStart.getTime() === todayStart.getTime()) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = timeSlot.start.split(':').map(Number);
      if (sh * 60 + sm <= currentMinutes) {
        return res.status(400).json({
          success: false,
          code: 'PAST_SLOT_NOT_ALLOWED',
          message: 'Selected time slot has already passed for today.'
        });
      }
    }

    // Verify doctor practices on this day of week
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = daysOfWeek[targetDayStart.getDay()];
    const availableDays = doctorProfile.availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!availableDays.includes(targetDayName)) {
      return res.status(400).json({
        success: false,
        code: 'DOCTOR_UNAVAILABLE_DAY',
        message: `Doctor is not available for consultations on ${targetDayName}.`
      });
    }

    // Search window for the targeted day
    const startOfDay = new Date(targetDayStart.getFullYear(), targetDayStart.getMonth(), targetDayStart.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDayStart.getFullYear(), targetDayStart.getMonth(), targetDayStart.getDate(), 23, 59, 59, 999);

    // Concurrency Guard: Check if slot is already booked for this doctor
    const existingBooking = await Appointment.findOne({
      doctor: doctorUserId,
      date: { $gte: startOfDay, $lte: endOfDay },
      'timeSlot.start': timeSlot.start,
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.DECLINED] }
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_ALREADY_BOOKED',
        message: 'This time slot is already booked. Please choose another slot.'
      });
    }

    // Concurrency Guard: Check if patient has an overlapping active appointment
    const patientBooking = await Appointment.findOne({
      patient: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      'timeSlot.start': timeSlot.start,
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.DECLINED] }
    });

    if (patientBooking) {
      return res.status(409).json({
        success: false,
        code: 'PATIENT_OVERLAPPING_APPOINTMENT',
        message: 'You already have another appointment scheduled during this time slot.'
      });
    }

    // Generate video room id if video call
    let videoRoomId = '';
    if (consultationType === APPOINTMENT_TYPES.VIDEO) {
      videoRoomId = `vitalink-room-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    }

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: doctorUserId,
      doctorProfile: doctorProfile._id,
      date: targetDayStart,
      timeSlot: {
        start: timeSlot.start,
        end: timeSlot.end
      },
      consultationType,
      reason: reason.trim(),
      status: APPOINTMENT_STATUS.PENDING,
      fee: doctorProfile.consultationFee || 500,
      notes: notes.trim(),
      videoRoomId
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctor', 'fullName email phone city state avatar')
      .populate('doctorProfile', 'specialization hospitalName hospitalAddress consultationFee')
      .populate('patient', 'fullName email phone');

    // Notify Doctor of new appointment request requiring review
    await createNotification({
      recipient: doctorUserId,
      sender: req.user._id,
      type: 'appointment_booked',
      title: 'New Appointment Request',
      message: `${req.user.fullName} requested a ${consultationType} consultation for ${timeSlot.start}.`,
      link: '/doctor/appointments',
      data: { appointmentId: appointment._id }
    });

    // Notify Patient that appointment is pending doctor review
    await createNotification({
      recipient: req.user._id,
      sender: doctorUserId,
      type: 'appointment_pending',
      title: 'Appointment Request Submitted',
      message: `Your ${consultationType} consultation request with Dr. ${doctorProfile.user?.fullName || 'Doctor'} has been submitted for review.`,
      link: '/patient/appointments',
      data: { appointmentId: appointment._id }
    });

    res.status(201).json({
      success: true,
      message: 'Appointment request submitted successfully. Awaiting doctor confirmation.',
      data: {
        appointment: populatedAppointment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's appointments (Patient or Doctor)
 * GET /api/v1/appointments/my
 * Access: Authenticated (Patient / Doctor)
 */
const getMyAppointments = async (req, res, next) => {
  try {
    const { status, upcoming, limit, eligibleOnly, forPrescription } = req.query;
    const query = {};

    if (req.user.role === ROLES.PATIENT) {
      query.patient = req.user._id;
    } else if (req.user.role === ROLES.DOCTOR) {
      query.doctor = req.user._id;
    } else if (req.user.role === ROLES.ADMIN) {
      if (req.query.doctorId) query.doctor = req.query.doctorId;
      if (req.query.patientId) query.patient = req.query.patientId;
    } else {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only patients and doctors can view appointment lists.'
      });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (eligibleOnly === 'true' || forPrescription === 'true') {
      query.status = { $in: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.COMPLETED] };
    } else if (status && status !== 'all') {
      if (status.includes(',')) {
        query.status = { $in: status.split(',').map((s) => s.trim()) };
      } else {
        query.status = status;
      }
    } else if (upcoming === 'true') {
      query.date = { $gte: todayStart };
      query.status = { $in: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.SUGGESTED_TIME] };
    } else if (upcoming === 'false') {
      query.$or = [
        { date: { $lt: todayStart } },
        { status: { $in: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.DECLINED] } }
      ];
    }

    const sortOrder = upcoming === 'true' ? { date: 1, 'timeSlot.start': 1 } : { date: -1, 'timeSlot.start': -1 };

    let appointmentQuery = Appointment.find(query)
      .populate('doctor', 'fullName avatar email phone city state')
      .populate('doctorProfile', 'specialization hospitalName hospitalAddress consultationFee')
      .populate('patient', 'fullName avatar email phone city state gender')
      .sort(sortOrder);

    const parsedLimit = parseInt(limit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      appointmentQuery = appointmentQuery.limit(parsedLimit);
    }

    const appointments = await appointmentQuery.lean();

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed appointment by ID
 * GET /api/v1/appointments/:id
 * Access: Authenticated (Patient, Doctor, or Admin)
 */
const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'fullName avatar email phone city state')
      .populate('doctorProfile', 'specialization hospitalName hospitalAddress consultationFee appointmentDuration')
      .populate('patient', 'fullName avatar email phone city state gender dateOfBirth');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    // Access control check
    const isPatient = appointment.patient?._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor?._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied to this appointment.'
      });
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update appointment status (Doctor or Admin)
 * PATCH /api/v1/appointments/:id/status
 * Access: Doctor or Admin
 */
const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;

    const validStatuses = Object.values(APPOINTMENT_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    // Check doctor or admin authorization
    const isDoctor = appointment.doctor.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the assigned doctor or an administrator can update appointment status.'
      });
    }

    appointment.status = status;
    if (notes) appointment.notes = notes;
    await appointment.save();

    if (status === APPOINTMENT_STATUS.COMPLETED) {
      await createNotification({
        recipient: appointment.patient,
        sender: req.user._id,
        type: 'system',
        title: 'Consultation Completed',
        message: 'Your consultation is marked as completed. Please leave a rating and review for your doctor!',
        link: '/patient/appointments',
        data: { appointmentId: appointment._id }
      });
    }

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}.`,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an appointment (Patient or Doctor)
 * PATCH /api/v1/appointments/:id/cancel
 * Access: Authenticated (Patient or Doctor)
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const { reason = 'Cancelled by user' } = req.body;

    const appointment = await Appointment.findById(req.params.id);
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
        message: 'Not authorized to cancel this appointment.'
      });
    }

    if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        code: 'CANNOT_CANCEL_COMPLETED',
        message: 'Cannot cancel an appointment that has already been completed.'
      });
    }

    if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_CANCELLED',
        message: 'This appointment is already cancelled.'
      });
    }

    appointment.status = APPOINTMENT_STATUS.CANCELLED;
    appointment.cancellationReason = reason.trim();
    await appointment.save();

    const isPatientCancelling = appointment.patient.toString() === req.user._id.toString();
    const recipientId = isPatientCancelling ? appointment.doctor : appointment.patient;

    await createNotification({
      recipient: recipientId,
      sender: req.user._id,
      type: 'appointment_cancelled',
      title: 'Appointment Cancelled',
      message: `The consultation has been cancelled: "${reason.trim()}".`,
      link: isPatientCancelling ? '/doctor/appointments' : '/patient/appointments',
      data: { appointmentId: appointment._id, reason: reason.trim() }
    });

    res.status(200).json({
      success: true,
      message: 'Appointment has been cancelled successfully.',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor Action: Accept pending appointment
 * PATCH /api/v1/appointments/:id/accept
 * Access: Authenticated Doctor
 */
const acceptAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    if (appointment.doctor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the assigned doctor can accept this appointment.'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: `Only pending appointments can be accepted. Current status: ${appointment.status}`
      });
    }

    // Verify slot is not already confirmed for another appointment
    const startOfDay = new Date(appointment.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointment.date);
    endOfDay.setHours(23, 59, 59, 999);

    const collision = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      'timeSlot.start': appointment.timeSlot.start,
      status: APPOINTMENT_STATUS.CONFIRMED
    });

    if (collision) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_ALREADY_CONFIRMED',
        message: 'Another appointment is already confirmed for this time slot.'
      });
    }

    appointment.status = APPOINTMENT_STATUS.CONFIRMED;
    await appointment.save();

    await createNotification({
      recipient: appointment.patient._id,
      sender: req.user._id,
      type: 'appointment_confirmed',
      title: 'Appointment Confirmed',
      message: `Dr. ${req.user.fullName} accepted your ${appointment.consultationType} consultation for ${appointment.timeSlot.start} on ${new Date(appointment.date).toLocaleDateString()}.`,
      link: '/patient/appointments',
      data: { appointmentId: appointment._id }
    });

    res.status(200).json({
      success: true,
      message: 'Appointment confirmed successfully.',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor Action: Suggest alternative date & time
 * PATCH /api/v1/appointments/:id/suggest-time
 * Access: Authenticated Doctor
 */
const suggestAppointmentTime = async (req, res, next) => {
  try {
    const date = req.body.date || req.body.suggestedDate;
    const timeSlot = req.body.timeSlot || req.body.suggestedTimeSlot;
    const reason = req.body.reason || req.body.suggestionReason || '';

    if (!date) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Proposed appointment date is required.'
      });
    }

    if (!timeSlot || !timeSlot.start || !timeSlot.end) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Proposed time slot with start and end times is required.'
      });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    if (appointment.doctor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the assigned doctor can suggest an alternative time.'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: `Only pending appointments can have time suggestions. Current status: ${appointment.status}`
      });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_DATE',
        message: 'Invalid date format.'
      });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

    if (targetDayStart < todayStart) {
      return res.status(400).json({
        success: false,
        code: 'PAST_DATE_NOT_ALLOWED',
        message: 'Cannot propose dates in the past.'
      });
    }

    if (targetDayStart.getTime() === todayStart.getTime()) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = timeSlot.start.split(':').map(Number);
      if (sh * 60 + sm <= currentMinutes) {
        return res.status(400).json({
          success: false,
          code: 'PAST_SLOT_NOT_ALLOWED',
          message: 'Selected time slot has already passed for today.'
        });
      }
    }

    // Verify doctor practice day
    const doctorProfile = await DoctorProfile.findOne({ user: req.user._id });
    if (doctorProfile) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const targetDayName = daysOfWeek[targetDayStart.getDay()];
      const availableDays = doctorProfile.availableDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      if (!availableDays.includes(targetDayName)) {
        return res.status(400).json({
          success: false,
          code: 'DOCTOR_UNAVAILABLE_DAY',
          message: `You are not scheduled for consultations on ${targetDayName}.`
        });
      }
    }

    // Check collision on proposed slot
    const startOfDay = new Date(targetDayStart.getFullYear(), targetDayStart.getMonth(), targetDayStart.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDayStart.getFullYear(), targetDayStart.getMonth(), targetDayStart.getDate(), 23, 59, 59, 999);

    const collision = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: req.user._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      'timeSlot.start': timeSlot.start,
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.DECLINED] }
    });

    if (collision) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_NOT_AVAILABLE',
        message: 'The proposed time slot is already booked or reserved.'
      });
    }

    appointment.status = APPOINTMENT_STATUS.SUGGESTED_TIME;
    appointment.suggestedDate = targetDayStart;
    appointment.suggestedTimeSlot = { start: timeSlot.start, end: timeSlot.end };
    appointment.suggestedBy = req.user._id;
    appointment.suggestedAt = new Date();
    appointment.suggestionReason = reason.trim();
    await appointment.save();

    await createNotification({
      recipient: appointment.patient._id,
      sender: req.user._id,
      type: 'appointment_time_suggested',
      title: 'New Consultation Time Proposed',
      message: `Dr. ${req.user.fullName} proposed a new appointment time: ${timeSlot.start} on ${targetDayStart.toLocaleDateString()}.`,
      link: '/patient/appointments',
      data: { appointmentId: appointment._id, suggestedDate: targetDayStart, suggestedTimeSlot: appointment.suggestedTimeSlot }
    });

    res.status(200).json({
      success: true,
      message: 'New consultation time proposed to patient successfully.',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor Action: Reject pending appointment
 * PATCH /api/v1/appointments/:id/reject
 * Access: Authenticated Doctor
 */
const rejectAppointment = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Rejection reason is required (minimum 3 characters).'
      });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    if (appointment.doctor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the assigned doctor can reject this appointment.'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: `Only pending appointments can be rejected. Current status: ${appointment.status}`
      });
    }

    appointment.status = APPOINTMENT_STATUS.REJECTED;
    appointment.rejectionReason = reason.trim();
    appointment.rejectedAt = new Date();
    appointment.rejectedBy = req.user._id;
    await appointment.save();

    await createNotification({
      recipient: appointment.patient._id,
      sender: req.user._id,
      type: 'appointment_rejected',
      title: 'Appointment Request Declined',
      message: `Dr. ${req.user.fullName} was unable to accept your appointment: "${reason.trim()}".`,
      link: '/patient/appointments',
      data: { appointmentId: appointment._id, reason: reason.trim() }
    });

    res.status(200).json({
      success: true,
      message: 'Appointment request rejected successfully.',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient Action: Accept doctor's suggested alternative time
 * PATCH /api/v1/appointments/:id/patient-accept
 * Access: Authenticated Patient
 */
const patientAcceptSuggestedTime = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    if (appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the patient can respond to this time suggestion.'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.SUGGESTED_TIME) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: `Appointment is not awaiting patient response. Current status: ${appointment.status}`
      });
    }

    if (!appointment.suggestedDate || !appointment.suggestedTimeSlot?.start) {
      return res.status(400).json({
        success: false,
        code: 'NO_SUGGESTED_TIME',
        message: 'No alternative time has been suggested for this appointment.'
      });
    }

    // Verify proposed slot is still free
    const startOfDay = new Date(appointment.suggestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointment.suggestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const collision = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: appointment.doctor._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      'timeSlot.start': appointment.suggestedTimeSlot.start,
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.DECLINED] }
    });

    if (collision) {
      return res.status(409).json({
        success: false,
        code: 'SUGGESTED_SLOT_TAKEN',
        message: 'The suggested time slot was booked in the interim. Please contact your doctor or pick another slot.'
      });
    }

    // Apply the suggested date & time and mark confirmed
    appointment.date = appointment.suggestedDate;
    appointment.timeSlot = {
      start: appointment.suggestedTimeSlot.start,
      end: appointment.suggestedTimeSlot.end
    };
    appointment.status = APPOINTMENT_STATUS.CONFIRMED;
    await appointment.save();

    await createNotification({
      recipient: appointment.doctor._id,
      sender: req.user._id,
      type: 'appointment_confirmed',
      title: 'Patient Accepted Proposed Time',
      message: `${req.user.fullName} accepted the suggested consultation time for ${appointment.timeSlot.start} on ${new Date(appointment.date).toLocaleDateString()}.`,
      link: '/doctor/appointments',
      data: { appointmentId: appointment._id }
    });

    res.status(200).json({
      success: true,
      message: 'Suggested appointment time accepted and confirmed.',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Patient Action: Decline doctor's suggested alternative time
 * PATCH /api/v1/appointments/:id/patient-decline
 * Access: Authenticated Patient
 */
const patientDeclineSuggestedTime = async (req, res, next) => {
  try {
    const { reason = 'Patient declined suggested time' } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'fullName email phone')
      .populate('doctor', 'fullName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found.'
      });
    }

    if (appointment.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the patient can decline this time suggestion.'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.SUGGESTED_TIME) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STATUS',
        message: `Appointment is not awaiting patient response. Current status: ${appointment.status}`
      });
    }

    appointment.status = APPOINTMENT_STATUS.DECLINED;
    appointment.declineReason = reason.trim();
    appointment.declinedAt = new Date();
    await appointment.save();

    await createNotification({
      recipient: appointment.doctor._id,
      sender: req.user._id,
      type: 'appointment_declined',
      title: 'Patient Declined Proposed Time',
      message: `${req.user.fullName} declined the suggested consultation time: "${reason.trim()}".`,
      link: '/doctor/appointments',
      data: { appointmentId: appointment._id, reason: reason.trim() }
    });

    res.status(200).json({
      success: true,
      message: 'Suggested appointment time declined.',
      data: { appointment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Doctor Schedule View: Get detailed slots & appointments for a date
 * GET /api/v1/appointments/schedule/view
 * Access: Authenticated Doctor or Admin
 */
const getDoctorSchedule = async (req, res, next) => {
  try {
    const { date, doctorId } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Date query parameter (YYYY-MM-DD) is required.'
      });
    }

    let targetDoctorUserId = req.user._id;
    if (req.user.role === ROLES.ADMIN && doctorId) {
      targetDoctorUserId = doctorId;
    }

    const doctorProfile = await DoctorProfile.findOne({ user: targetDoctorUserId });
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        code: 'DOCTOR_PROFILE_NOT_FOUND',
        message: 'Doctor profile not found.'
      });
    }

    const scheduleData = await slotService.getDoctorDaySchedule({
      doctorProfile,
      dateStr: date
    });

    res.status(200).json({
      success: true,
      message: 'Doctor day schedule retrieved successfully.',
      data: scheduleData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  acceptAppointment,
  suggestAppointmentTime,
  rejectAppointment,
  patientAcceptSuggestedTime,
  patientDeclineSuggestedTime,
  getDoctorSchedule
};
