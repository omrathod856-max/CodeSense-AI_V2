const { extractCodeFromRepo } = require("../utils/repomix");
const { generateInterviewFromCode } = require("../utils/remotellm");
const InterviewModel = require("../models/interviews");
const VoiceInterviewSession = require("../models/voiceInterview");

const generateInterview = async (req, res) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return res.status(400).json({
        message: "Repository URL is required",
        success: false,
      });
    }

    // 1. Extract code from repo
    const repoContext = await extractCodeFromRepo(repoUrl);
    const code =
      typeof repoContext === "string"
        ? repoContext
        : (repoContext && repoContext.code) || "";

    if (!code.trim()) {
      return res.status(400).json({
        message: "Repomix returned empty context",
        success: false,
      });
    }

    // 2. Generate interview from code
    const interview = await generateInterviewFromCode({
      code,
      language: "mixed",
      role: "Software Engineer",
      difficulty: "medium",
      focusAreas: ["problem solving", "code quality", "debugging"],
    });

    if (interview.error) {
      return res.status(502).json({
        message: "Interview generation failed: invalid model response",
        error: interview.error,
        success: false,
      });
    }

    const savedInterview = await InterviewModel.create({
      userId: req.user.id,
      repoUrl,
      summary: interview.summary,
      questions: interview.questions,
      hands_on_task: interview.hands_on_task,
      follow_ups: interview.follow_ups,
    });

    return res.status(200).json({
      message: "Interview generated successfully",
      success: true,
      data: {
        ...interview,
        repoContext: code,
        _id: savedInterview._id,
        createdAt: savedInterview.createdAt,
      },
    });

  } catch (error) {
    console.error("Error in generateInterview:", error);
    const errorMessage = error?.message || "Unknown error";
    const isUpstreamError = /ollama|remote llm|ngrok|endpoint|abort|timeout|invalid chat response/i.test(
      errorMessage
    );

    return res.status(isUpstreamError ? 502 : 500).json({
      message: isUpstreamError
        ? "Upstream LLM request failed"
        : "Internal server error during interview generation",
      error: errorMessage,
      success: false,
    });
  }
};

const listRecentInterviews = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 30), 100);
    console.log('Fetching recent activity for user:', req.user.id);
    
    // Fetch repo analyses
    const interviews = await InterviewModel.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    console.log(`Found ${interviews.length} repository analyses.`);

    // Fetch voice interview sessions with evaluations
    const voiceSessions = await VoiceInterviewSession.find({ 
        userId: req.user.id,
        status: 'ended',
        evaluation: { $ne: null } 
      })
      .sort({ endedAt: -1 })
      .limit(limit)
      .lean();

    console.log(`Found ${voiceSessions.length} voice interview sessions with evaluations.`);

    if (voiceSessions.length === 0) {
      const anySession = await VoiceInterviewSession.findOne({ userId: req.user.id }).lean();
      if (anySession) {
        console.log('User has sessions, but none matched the criteria (ended + evaluation).');
        console.log('Sample session:', JSON.stringify(anySession, null, 2));
      } else {
        console.log('User has NO voice interview sessions in the database.');
      }
    }

    return res.status(200).json({ 
      success: true, 
      interviews,
      voiceSessions 
    });
  } catch (error) {
    console.error('Error in listRecentInterviews:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch interviews",
      error: error.message,
    });
  }
};

const getInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await InterviewModel.findOne({ _id: id, userId: req.user.id }).lean();

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: interview,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load interview",
      error: error.message,
    });
  }
};

const deleteInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await InterviewModel.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!result) {
      return res.status(404).json({ success: false, message: "Interview not found or unauthorized" });
    }
    return res.status(200).json({ success: true, message: "Interview deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete interview",
      error: error.message,
    });
  }
};

const deleteVoiceInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await VoiceInterviewSession.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!result) {
      return res.status(404).json({ success: false, message: "Session not found or unauthorized" });
    }
    return res.status(200).json({ success: true, message: "Voice session deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete voice session",
      error: error.message,
    });
  }
};

const clearAllInterviews = async (req, res) => {
  try {
    await InterviewModel.deleteMany({ userId: req.user.id });
    await VoiceInterviewSession.deleteMany({ userId: req.user.id });
    return res.status(200).json({ success: true, message: "All activity cleared" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to clear interviews",
      error: error.message,
    });
  }
};

module.exports = {
  generateInterview,
  listRecentInterviews,
  getInterviewById,
  deleteInterviewById,
  deleteVoiceInterviewById,
  clearAllInterviews,
};
