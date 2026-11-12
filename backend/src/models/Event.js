const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: {
    type: String,
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  eventType: {
    type: String,
    enum: ['Conference', 'Workshop', 'Seminar', 'Sports', 'Cultural', 'Academic', 'Social', 'Other'],
    required: true,
  },
  // Newsletter section this event belongs to — separate from eventType,
  // since eventType is about the nature of the event (Workshop/Seminar)
  // while activityCategory is about which report section it appears in.
  activityCategory: {
    type: String,
    enum: [
      'EVENTS_CONDUCTED',
      'RESOURCE_PERSON',
      'WORKSHOP_ORGANIZED',
      'ALUMNI_INTERACTION',
      'FDP_ORGANIZED',
      'SPORTS_NCC',
      'OTHER',
      'MOU',
      'STUDENT_ACHIEVEMENT',
      'PROFESSIONAL_ACTIVITY',
      'INDUSTRIAL_VISIT',
      'COLLABORATIVE_RESEARCH',
      'BICEP_ACTIVITY',
      'CLUB_ACTIVITY',
      'PLACEMENT_ACTIVITY',
      'HEC_EVENT',
      'SPORTS',
      'NCC',
      'NSS',
      'FACULTY_AWARD',
    ],
    default: 'OTHER',
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true,
  },
  coDepartments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
  ],
  cluster: String,
  // Completes the Department > Cluster > Section hierarchy on the event
  // itself. Without this, FACULTY's section was locked on the User model
  // but silently dropped when saving the Event (Mongoose drops
  // unrecognized fields by default under strict mode).
  section: String,
  eventDate: {
    type: Date,
    required: true,
    index: true,
  },
  eventTime: String,
  location: String,
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organizerName: String,
  organizerContact: String,
  expectedAttendance: Number,
  budget: Number,
  achievements: String,
  tags: [String],
  participants: [
    {
      usn: { type: String, required: true },
      name: { type: String, required: true },
      department: { type: String, required: true },
    },
  ],
  photos: [
    {
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'],
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
  departmentVisible: {
    type: Boolean,
    default: true,
  },
  publishedAt: Date,
  publishedIn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Newsletter',
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

eventSchema.index({ eventName: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Event', eventSchema);