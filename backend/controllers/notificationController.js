const Notification = require('../models/Notification');

/**
 * Get notifications for authenticated user
 * GET /api/v1/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const { isRead, type, page = 1, limit = 20 } = req.query;
    const query = { recipient: req.user._id };

    if (isRead !== undefined) {
      query.isRead = isRead === 'true' || isRead === true;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'fullName role avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, isRead: false })
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take) || 1,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notifications count for authenticated user
 * GET /api/v1/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount: count,
      data: {
        unreadCount: count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 * PATCH /api/v1/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found.'
      });
    }

    // Must be the recipient
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only update your own notifications.'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications for authenticated user as read
 * PATCH /api/v1/notifications/mark-all-read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 * DELETE /api/v1/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found.'
      });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You can only delete your own notifications.'
      });
    }

    await Notification.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: 'Notification deleted.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
