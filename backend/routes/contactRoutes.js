const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const { contactLimiter } = require('../middleware/rateLimiter');

// @desc    Submit a contact message (Public)
// @route   POST /api/v1/contact
// @access  Public
router.post('/', contactLimiter, async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required.',
        code: 'NAME_REQUIRED'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
        code: 'EMAIL_REQUIRED'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required.',
        code: 'MESSAGE_REQUIRED'
      });
    }

    const contact = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject ? subject.trim() : 'General Inquiry',
      message: message.trim(),
      status: 'new'
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for reaching out! Your message has been received.',
      data: {
        id: contact._id,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
