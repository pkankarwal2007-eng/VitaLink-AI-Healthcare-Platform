const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Convert HH:MM string to minutes since midnight
 */
const toMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Convert minutes since midnight to HH:MM string
 */
const toTimeStr = (totalMinutes) => {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Generate dynamic appointment slots for a doctor on a specific date
 * 
 * @param {object} params
 * @param {object} params.doctorProfile - DoctorProfile document
 * @param {string} params.dateStr - Date string in YYYY-MM-DD format
 * @returns {Promise<object>} Generated slots and availability status
 */
const generateDoctorSlots = async ({ doctorProfile, dateStr }) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const err = new Error('Invalid date format. Expected YYYY-MM-DD.');
    err.status = 400;
    throw err;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayName = DAYS_OF_WEEK[targetDate.getDay()];

  // Check if requested date is in the past
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (targetDate < todayStart) {
    return {
      date: dateStr,
      dayName,
      isWorkingDay: false,
      isPastDate: true,
      message: 'Cannot schedule appointments for past dates.',
      slots: []
    };
  }

  const isToday = targetDate.getTime() === todayStart.getTime();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Check if doctor works on this day of the week
  const availableDays = doctorProfile.availableDays || [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ];
  const isWorkingDay = availableDays.includes(dayName);

  if (!isWorkingDay) {
    return {
      date: dateStr,
      dayName,
      isWorkingDay: false,
      isPastDate: false,
      message: `Doctor does not hold consultations on ${dayName}s.`,
      slots: []
    };
  }

  // Work hours & duration
  const startTimeStr = doctorProfile.availableTime?.start || '09:00';
  const endTimeStr = doctorProfile.availableTime?.end || '17:00';
  const breakStartStr = doctorProfile.breakTime?.start || '13:00';
  const breakEndStr = doctorProfile.breakTime?.end || '14:00';
  const duration = doctorProfile.appointmentDuration || 30;

  const workStart = toMinutes(startTimeStr);
  const workEnd = toMinutes(endTimeStr);
  const breakStart = toMinutes(breakStartStr);
  const breakEnd = toMinutes(breakEndStr);

  // Retrieve existing non-cancelled bookings for this doctor on this day
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const existingBookings = await Appointment.find({
    doctor: doctorProfile.user,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled', 'rejected', 'declined'] }
  }).select('timeSlot status');

  const bookedStarts = new Set(existingBookings.map((b) => b.timeSlot?.start));

  const slots = [];

  for (let current = workStart; current + duration <= workEnd; current += duration) {
    const slotStart = current;
    const slotEnd = current + duration;

    // Check if slot overlaps with break time
    const overlapsWithBreak = slotStart < breakEnd && slotEnd > breakStart;
    if (overlapsWithBreak) {
      continue;
    }

    const startStr = toTimeStr(slotStart);
    const endStr = toTimeStr(slotEnd);

    const isPast = isToday && slotStart <= currentMinutes;
    const isBooked = bookedStarts.has(startStr);
    const isAvailable = !isPast && !isBooked;

    slots.push({
      start: startStr,
      end: endStr,
      isAvailable,
      isBooked,
      isPast
    });
  }

  return {
    date: dateStr,
    dayName,
    isWorkingDay: true,
    isPastDate: false,
    doctorFee: doctorProfile.consultationFee || 500,
    consultationModes: doctorProfile.consultationModes || ['chat', 'video', 'physical'],
    slots,
    availableSlotsCount: slots.filter((s) => s.isAvailable).length,
    totalSlotsCount: slots.length
  };
};

/**
 * Generate full detailed daily schedule for a doctor including
 * AVAILABLE, PENDING, BOOKED, BREAK, and UNAVAILABLE slots with patient info.
 */
const getDoctorDaySchedule = async ({ doctorProfile, dateStr }) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const err = new Error('Invalid date format. Expected YYYY-MM-DD.');
    err.status = 400;
    throw err;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayName = DAYS_OF_WEEK[targetDate.getDay()];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isToday = targetDate.getTime() === todayStart.getTime();
  const isPastDate = targetDate < todayStart;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const availableDays = doctorProfile.availableDays || [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ];
  const isWorkingDay = availableDays.includes(dayName);

  const startTimeStr = doctorProfile.availableTime?.start || '09:00';
  const endTimeStr = doctorProfile.availableTime?.end || '17:00';
  const breakStartStr = doctorProfile.breakTime?.start || '13:00';
  const breakEndStr = doctorProfile.breakTime?.end || '14:00';
  const duration = doctorProfile.appointmentDuration || 30;

  const workStart = toMinutes(startTimeStr);
  const workEnd = toMinutes(endTimeStr);
  const breakStart = toMinutes(breakStartStr);
  const breakEnd = toMinutes(breakEndStr);

  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const doctorUserId = doctorProfile.user?._id || doctorProfile.user;

  const activeAppointments = await Appointment.find({
    doctor: doctorUserId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled', 'rejected', 'declined'] }
  })
    .populate('patient', 'fullName email phone gender dateOfBirth avatar')
    .lean();

  const appointmentMap = {};
  activeAppointments.forEach((apt) => {
    if (apt.timeSlot?.start) {
      appointmentMap[apt.timeSlot.start] = apt;
    }
  });

  const slots = [];
  let availableCount = 0;
  let bookedCount = 0;
  let pendingCount = 0;

  for (let current = workStart; current + duration <= workEnd; current += duration) {
    const slotStart = current;
    const slotEnd = current + duration;
    const startStr = toTimeStr(slotStart);
    const endStr = toTimeStr(slotEnd);

    const overlapsWithBreak = slotStart < breakEnd && slotEnd > breakStart;

    if (overlapsWithBreak) {
      slots.push({
        start: startStr,
        end: endStr,
        state: 'BREAK',
        label: 'Break Time',
        appointment: null
      });
      continue;
    }

    if (!isWorkingDay) {
      slots.push({
        start: startStr,
        end: endStr,
        state: 'UNAVAILABLE',
        label: 'Off Duty',
        appointment: null
      });
      continue;
    }

    const isPastSlot = (isToday && slotStart <= currentMinutes) || isPastDate;
    const existingApt = appointmentMap[startStr];

    if (existingApt) {
      if (existingApt.status === 'confirmed') {
        bookedCount++;
        slots.push({
          start: startStr,
          end: endStr,
          state: 'BOOKED',
          label: 'Confirmed Appointment',
          appointment: existingApt
        });
      } else if (existingApt.status === 'pending') {
        pendingCount++;
        slots.push({
          start: startStr,
          end: endStr,
          state: 'PENDING',
          label: 'Pending Review',
          appointment: existingApt
        });
      } else if (existingApt.status === 'suggested_time') {
        slots.push({
          start: startStr,
          end: endStr,
          state: 'SUGGESTED_TIME',
          label: 'Time Proposed',
          appointment: existingApt
        });
      } else {
        slots.push({
          start: startStr,
          end: endStr,
          state: existingApt.status.toUpperCase(),
          label: existingApt.status,
          appointment: existingApt
        });
      }
    } else {
      if (isPastSlot) {
        slots.push({
          start: startStr,
          end: endStr,
          state: 'PAST',
          label: 'Past Slot',
          appointment: null
        });
      } else {
        availableCount++;
        slots.push({
          start: startStr,
          end: endStr,
          state: 'AVAILABLE',
          label: 'Available',
          appointment: null
        });
      }
    }
  }

  return {
    date: dateStr,
    dayName,
    isWorkingDay,
    isPastDate,
    workHours: { start: startTimeStr, end: endTimeStr },
    breakHours: { start: breakStartStr, end: breakEndStr },
    slots,
    stats: {
      totalSlots: slots.length,
      availableCount,
      bookedCount,
      pendingCount
    }
  };
};

module.exports = {
  generateDoctorSlots,
  getDoctorDaySchedule,
  toMinutes,
  toTimeStr
};
