const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  compiledHtml: {
    type: String,
    required: true,
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewsletterTemplate',
  },
  periodStartDate: {
    type: Date,
    required: true,
  },
  periodEndDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT',
    index: true,
  },
  publishedAt: Date,
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  scheduledFor: Date,
  isRecurring: Boolean,
  recurrenceRule: String,
  recipients: {
    roles: [String],
    departments: [mongoose.Schema.Types.ObjectId],
    totalCount: Number,
  },
  includedEvents: [
    {
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
      },
      position: Number,
    },
  ],
  includedPublications: [
    {
      publicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Publication',
      },
      position: Number,
    },
  ],
  deliveryStats: {
    totalSent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
  },
  version: {
    type: Number,
    default: 1,
  },
  previousVersions: [
    {
      versionNumber: Number,
      html: String,
      createdAt: Date,
    },
  ],

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

newsletterSchema.index({ status: 1, createdAt: -1 });
newsletterSchema.index({ publishedAt: 1 });
newsletterSchema.index({ scheduledFor: 1 });
newsletterSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Newsletter', newsletterSchema);