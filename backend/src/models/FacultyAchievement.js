const mongoose = require('mongoose');

const facultyAchievementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: ['GRANT', 'CERTIFICATION', 'COMMITTEE_ROLE', 'AWARD', 'OTHER'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  awardingBody: String, // e.g. "AICTE", "Research and Consultancy Cell, BMSIT&M"
  amount: Number, // for GRANT category — seed money etc.
  achievementDate: {
    type: Date,
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  cluster: String,
  section: String,
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PUBLISHED'],
    default: 'DRAFT',
    index: true,
  },
  approvalHistory: [
    {
      approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      action: {
        type: String,
        enum: ['SUBMITTED', 'APPROVED', 'REJECTED'],
      },
      feedback: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  publishedIn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Newsletter',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

facultyAchievementSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('FacultyAchievement', facultyAchievementSchema);