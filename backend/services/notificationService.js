const Notification = require('../models/Notification');
const { getIO } = require('./socketService');

/**
 * Creates and persists a notification, and pushes it via Socket.IO if connected.
 * @param {Object} params
 * @param {string|ObjectId} params.recipient - User ID of the recipient
 * @param {string|ObjectId} [params.sender] - User ID of the sender (optional)
 * @param {string} params.type - Notification category
 * @param {string} params.title - Short title
 * @param {string} params.message - Safe, informative message
 * @param {string} [params.link] - Frontend navigation path
 * @param {Object} [params.data] - Additional metadata references
 */
const createNotification = async ({
  recipient,
  sender = null,
  type = 'system',
  title,
  message,
  link = '',
  data = {}
}) => {
  try {
    if (!recipient || !title || !message) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title: title.trim(),
      message: message.trim(),
      link: link.trim(),
      data,
      isRead: false
    });

    // Real-time Push via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`user:${recipient.toString()}`).emit('notification', {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        isRead: false,
        data: notification.data
      });
    }

    return notification;
  } catch (err) {
    console.error('[NotificationService Error]', err.message);
    return null;
  }
};

module.exports = {
  createNotification
};
