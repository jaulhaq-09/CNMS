const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
        enum: [
      'EVENT_APPROVED',
      'EVENT_REJECTED',
      'EVENT_SUBMITTED',
      'APPROVAL_REQUESTED',
      'ITEM_APPROVED',
      'ITEM_REJECTED',
      'APPROVAL_COMPLETED',
      'NEWSLETTER_PUBLISHED',
      'NEWSLETTER_SCHEDULED',
      'COMMENT',
      'MENTION',
      'SYSTEM',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    eventId: mongoose.Schema.Types.ObjectId,
    newsletterId: mongoose.Schema.Types.ObjectId,
    templateId: mongoose.Schema.Types.ObjectId,
    itemId: mongoose.Schema.Types.ObjectId,
    itemType: String,
    relatedUrl: String,
  },
  channels: {
    email: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: Date,
    },
    sms: {
      enabled: { type: Boolean, default: false },
      sent: { type: Boolean, default: false },
      sentAt: Date,
    },
    push: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: Date,
    },
    inApp: {
      enabled: { type: Boolean, default: true },
      read: { type: Boolean, default: false },
      readAt: Date,
    },
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM',
    index: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'ARCHIVED'],
    default: 'PENDING',
    index: true,
  },
  metadata: {
    tags: [String],
    category: String,
    source: String,
  },
  scheduling: {
    sendAt: Date,
    timezone: String,
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
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    index: true,
  },
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, 'channels.inApp.read': 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);