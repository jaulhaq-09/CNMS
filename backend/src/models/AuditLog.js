const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'EVENT_APPROVED',
      'EVENT_REJECTED',
      'PUBLICATION_APPROVED',
      'PUBLICATION_REJECTED',
      'PATENT_APPROVED',
      'PATENT_REJECTED',
      'ACHIEVEMENT_APPROVED',
      'ACHIEVEMENT_REJECTED',
      'NEWSLETTER_GENERATED',
      'NEWSLETTER_SCHEDULED',
      'NEWSLETTER_PUBLISHED',
      'NEWSLETTER_DELETED',
      'USER_CREATED',
      'USER_ACCESS_UPDATED',
      'USER_DELETED',
      'USER_IMPORTED',
      'USER_CREDENTIALS_RESENT',
      'DEPARTMENT_CREATED',
      'DEPARTMENT_UPDATED',
      'DEPARTMENT_REACTIVATED',
      'DEPARTMENT_DEACTIVATED',
      'SETTINGS_UPDATED',
    ],
    index: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  targetType: {
    type: String,
    enum: [
      'Event',
      'Newsletter',
      'User',
      'Department',
      'Publication',
      'Patent',
      'Achievement',
      'Settings',
    ],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  // Human-readable name of the target at the time of the action
  // (event name, person's name, newsletter title...), so the Activity log
  // stays readable even after the target is renamed or deleted.
  targetLabel: String,
  // Free-form snapshot of whatever's useful for this action — e.g.
  // { feedback } for a rejection, { previousRole, newRole } for a role
  // change. Kept schemaless since each action needs different context.
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);