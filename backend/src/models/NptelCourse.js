const mongoose = require('mongoose');

const nptelCourseSchema = new mongoose.Schema({
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  courseName: {
    type: String,
    required: true,
    index: true,
  },
  platform: {
    type: String,
    default: 'NPTEL',
  },
  duration: String, // e.g. "8 weeks"
  startDate: Date,
  completionDate: Date,
  certificateEarned: {
    type: Boolean,
    default: false,
  },
  certificateUrl: String,
  certificateFileName: String,
  score: String, // e.g. "82%" or "Elite + Gold"
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
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

nptelCourseSchema.index({ courseName: 'text', score: 'text' });

module.exports = mongoose.model('NptelCourse', nptelCourseSchema);