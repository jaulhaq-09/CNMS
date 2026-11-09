const mongoose = require('mongoose');

const newsletterTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true,
  },
  description: String,
  structure: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  compiledHtml: String,
  category: String,
  tags: [String],
  version: {
    type: Number,
    default: 1,
  },
  previousVersions: [
    {
      versionNumber: Number,
      structure: mongoose.Schema.Types.Mixed,
      compiledHtml: String,
      createdAt: Date,
    },
  ],
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
  isMprTemplate: {
    type: Boolean,
    default: false,
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  lastUsedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

newsletterTemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('NewsletterTemplate', newsletterTemplateSchema);