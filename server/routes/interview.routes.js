const express = require('express');
const {
	generateInterview,
	listRecentInterviews,
	getInterviewById,
	deleteInterviewById,
	deleteVoiceInterviewById,
	clearAllInterviews,
} = require('../controllers/interview.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// Publicly generate for now, or add authMiddleware middleware
router.post('/generate', authMiddleware, generateInterview);
router.get('/recent', authMiddleware, listRecentInterviews);
router.get('/:id', authMiddleware, getInterviewById);
router.delete('/voice/:id', authMiddleware, deleteVoiceInterviewById);
router.delete('/:id', authMiddleware, deleteInterviewById);
router.delete('/', authMiddleware, clearAllInterviews);

module.exports = router;
