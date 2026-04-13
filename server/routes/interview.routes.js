const express = require('express');
const {
	generateInterview,
	listRecentInterviews,
	getInterviewById,
	deleteInterviewById,
	clearAllInterviews,
} = require('../controllers/interview.controller');
const { checkAuth } = require('../middlewares/auth');

const router = express.Router();

// Publicly generate for now, or add checkAuth middleware
router.post('/generate', generateInterview);
router.get('/recent', listRecentInterviews);
router.get('/:id', getInterviewById);
router.delete('/:id', deleteInterviewById);
router.delete('/', clearAllInterviews);

module.exports = router;
