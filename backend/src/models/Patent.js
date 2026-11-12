const mongoose = require('mongoose');

const patentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true,
  },
  inventors: {
    type: [String],
    required: true,
    validate: {
      validator: (arr) => arr.length > 0,
      message: 'At least one inventor is required',
    },
  },
  patentNumber: String, // may be blank while still APPLIED
  grantingAuthority: {
    type: String,
    required: true, // e.g. "Intellectual Property Office of India"
  },
  // Real-world patent lifecycle — distinct from `status` below, which is
  // this app's internal review workflow (draft -> submitted -> approved).
  grantStatus: {
    type: String,
    enum: ['APPLIED', 'PUBLISHED', 'GRANTED'],
    required: true,
  },
  filingDate: Date,
  grantDate: Date,
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
        enum: ['SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED'],
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

patentSchema.index({ title: 'text', inventors: 'text' });

module.exports = mongoose.model('Patent', patentSchema);