const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  description: String,
  type: {
    type: String,
    enum: [
      'EVENTS',
      'NEWSLETTERS',
      'PUBLICATIONS',
      'PATENTS',
      'ACHIEVEMENTS',
      'NPTEL',
      'TEMPLATES',
      'ACTIVITY',
      'CUSTOM',
      'CLUSTER_REPORT',
      'INSTITUTIONAL_REPORT',
    ],
    required: true,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED_TO_ADMIN', 'CONSOLIDATED', 'ARCHIVED'],
    default: 'DRAFT',
  },
  cluster: String,
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  forwardedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  forwardedAt: Date,
  coordinatorComments: String,
  curatedItems: [mongoose.Schema.Types.Mixed],
  summary: mongoose.Schema.Types.Mixed,
  consolidatedReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
  },
  sourceReportIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
  ],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filters: {
    status: String,
    dateFrom: Date,
    dateTo: Date,
    department: mongoose.Schema.Types.ObjectId,
    category: String,
  },
  columns: [String],
  metrics: [String],
  format: {
    type: String,
    enum: ['PDF', 'CSV', 'EXCEL', 'JSON'],
    default: 'PDF',
  },
  scheduling: {
    enabled: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
    },
    dayOfWeek: Number,
    dayOfMonth: Number,
    time: String,
    recipients: [String],
  },
  lastGenerated: {
    date: Date,
    fileName: String,
    size: Number,
  },
  generationHistory: [
    {
      date: Date,
      fileName: String,
      size: Number,
      status: String,
    },
  ],
  isPublic: {
    type: Boolean,
    default: false,
  },
  settings: {
    includeCharts: {
      type: Boolean,
      default: true,
    },
    includeSummary: {
      type: Boolean,
      default: true,
    },
    pageOrientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait',
    },
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

reportSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);