const AIConversation = require('../models/AIConversation');
const AIMessage = require('../models/AIMessage');
const aiService = require('../services/aiService');
const { getSupportedSpecializations } = require('../services/specialistRecommendationService');

/**
 * Handle new patient chat message and generate structured AI clinical assessment
 * POST /api/v1/ai/chat
 */
const handleChat = async (req, res, next) => {
  try {
    const { conversationId, message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Message is required and cannot be empty.'
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Message is too long (maximum 2000 characters).'
      });
    }

    let conversation;

    if (conversationId) {
      conversation = await AIConversation.findOne({
        _id: conversationId,
        patient: req.user._id
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found or access denied.'
        });
      }
    } else {
      // Create new conversation with title derived from first message
      let title = message.trim().replace(/\s+/g, ' ').slice(0, 45);
      if (message.trim().length > 45) title += '...';

      conversation = await AIConversation.create({
        patient: req.user._id,
        title
      });
    }

    // Fetch recent conversation message history for conversational context (up to 10 latest messages)
    const recentMessages = await AIMessage.find({
      conversation: conversation._id
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('sender message structuredData createdAt')
      .lean();

    // Reverse to maintain chronological order for conversational memory
    const previousMessages = recentMessages.reverse();

    // Persist current patient user message
    const patientMsg = await AIMessage.create({
      conversation: conversation._id,
      patient: req.user._id,
      sender: 'patient',
      message: message.trim()
    });

    let aiResult;
    try {
      aiResult = await aiService.generateHealthAssessment({
        message: message.trim(),
        history: previousMessages
      });
    } catch (aiErr) {
      // Return structured config / service error without crashing
      const statusCode = aiErr.status || 500;
      return res.status(statusCode).json({
        success: false,
        code: aiErr.code || 'AI_ERROR',
        message: aiErr.message,
        data: {
          conversationId: conversation._id
        }
      });
    }

    const { structuredData, isEmergency, disclaimer } = aiResult;

    // Persist assistant message with structured medical data
    const assistantMsg = await AIMessage.create({
      conversation: conversation._id,
      patient: req.user._id,
      sender: 'assistant',
      message: structuredData.summary,
      structuredData,
      isEmergency,
      disclaimer
    });

    // Update conversation state
    conversation.suggestedSpecialty = structuredData.recommendedSpecialty;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return res.status(200).json({
      success: true,
      message: 'Health assessment generated successfully.',
      data: {
        conversation: {
          id: conversation._id,
          title: conversation.title,
          suggestedSpecialty: conversation.suggestedSpecialty,
          lastMessageAt: conversation.lastMessageAt
        },
        userMessage: patientMsg,
        assistantMessage: assistantMsg
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all AI conversations for current authenticated patient
 * GET /api/v1/ai/conversations
 */
const getConversations = async (req, res, next) => {
  try {
    const conversations = await AIConversation.find({
      patient: req.user._id
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get conversation by ID with all messages
 * GET /api/v1/ai/conversations/:id
 */
const getConversationById = async (req, res, next) => {
  try {
    const conversation = await AIConversation.findOne({
      _id: req.params.id,
      patient: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found or access denied.'
      });
    }

    const messages = await AIMessage.find({
      conversation: conversation._id,
      patient: req.user._id
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        conversation,
        messages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update conversation title
 * PATCH /api/v1/ai/conversations/:id
 */
const updateConversation = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Title is required and cannot be empty.'
      });
    }

    const conversation = await AIConversation.findOneAndUpdate(
      {
        _id: req.params.id,
        patient: req.user._id
      },
      {
        title: title.trim().slice(0, 120)
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found or access denied.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Conversation updated successfully.',
      data: conversation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a conversation and all its messages
 * DELETE /api/v1/ai/conversations/:id
 */
const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await AIConversation.findOne({
      _id: req.params.id,
      patient: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found or access denied.'
      });
    }

    // Delete all messages belonging to this conversation
    await AIMessage.deleteMany({
      conversation: conversation._id,
      patient: req.user._id
    });

    // Delete conversation
    await AIConversation.deleteOne({ _id: conversation._id });

    return res.status(200).json({
      success: true,
      message: 'Conversation and all assessment history deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get supported medical specializations
 * GET /api/v1/ai/specialists
 */
const getSpecialists = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: getSupportedSpecializations()
  });
};

module.exports = {
  handleChat,
  getConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  getSpecialists
};
