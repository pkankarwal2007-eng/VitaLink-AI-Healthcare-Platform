const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getChatMessages,
  sendChatMessage,
  getMyConversations,
  getVideoRoomAuth,
  endConsultationSession,
  getPhysicalConsultationDetails
} = require('../controllers/consultationController');

// All consultation routes require authentication
router.use(protect);

// Chat endpoints
router.get('/chat/:appointmentId', getChatMessages);
router.post('/chat/:appointmentId', sendChatMessage);
router.get('/conversations', getMyConversations);

// WebRTC Video Room authentication & session management
router.get('/video/:appointmentId/auth', getVideoRoomAuth);
router.patch('/video/:appointmentId/end', endConsultationSession);

// Physical in-person consultation pass
router.get('/physical/:appointmentId', getPhysicalConsultationDetails);

module.exports = router;
