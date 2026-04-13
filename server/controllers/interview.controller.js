const { extractCodeFromRepo } = require("../utils/repomix");
const { generateInterviewFromCode } = require("../utils/remotellm");
const InterviewModel = require("../models/interviews");

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
    const interviews = await InterviewModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: interviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load recent interviews",
      error: error.message,
    });
  }
};

const getInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await InterviewModel.findById(id).lean();

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
    await InterviewModel.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Interview deleted" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete interview",
      error: error.message,
    });
  }
};

const clearAllInterviews = async (req, res) => {
  try {
    await InterviewModel.deleteMany({});
    return res.status(200).json({ success: true, message: "All interviews cleared" });
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
  clearAllInterviews,
};
