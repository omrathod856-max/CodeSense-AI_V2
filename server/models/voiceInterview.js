const mongoose = require('./db.connection');

const turnSchema = new mongoose.Schema(
  {
    speaker: {
      type: String,
      enum: ['Candidate', 'Interviewer'],
      required: true,
    },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const voiceInterviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    socketId: { type: String, required: true, index: true },
    candidateName: { type: String, default: 'Candidate' },
    repoUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'ended', 'abandoned', 'restarted'],
      default: 'active',
    },
    evaluation: {
      score: Number,
      feedback: String,
      strengths: [String],
      weaknesses: [String]
    },
    turns: { type: [turnSchema], default: [] },
    metadata: {
      role: { type: String, default: 'Software Engineer' },
      difficulty: { type: String, default: 'medium' },
      language: { type: String, default: 'mixed' },
    },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VoiceInterviewSession', voiceInterviewSchema);
