const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');
const {
  handleChat,
  getConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  getSpecialists
} = require('../controllers/aiController');

// Public or general specialist listing
router.get('/specialists', getSpecialists);

// Patient protected routes
router.use(protect);
router.use(authorize('patient'));

router.post('/chat', aiLimiter, handleChat);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversationById);
router.patch('/conversations/:id', updateConversation);
router.delete('/conversations/:id', deleteConversation);

module.exports = router;
