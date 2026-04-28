const mongoose = require('./db.connection');

const interviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    repoUrl: { type: String, required: true, trim: true },
    summary: { type: String, required: true },
    questions: { type: Array, default: [] },
    hands_on_task: {
      prompt: { type: String, default: '' },
      evaluation_rubric: { type: [String], default: [] },
    },
    follow_ups: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);
