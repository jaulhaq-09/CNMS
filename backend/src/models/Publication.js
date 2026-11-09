const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true,
  },
  authors: {
    type: [String],
    required: true,
    validate: {
      validator: (arr) => arr.length > 0,
      message: 'At least one author is required',
    },
  },
  publicationType: {
    type: String,
    enum: ['JOURNAL', 'CONFERENCE', 'BOOK', 'BOOK_CHAPTER'],
    required: true,
  },
  venueName: {
    // Journal name (JOURNAL), conference name (CONFERENCE) or book title
    // (BOOK_CHAPTER). Not used for BOOK, where the title is the book itself.
    type: String,
    required: function () {
      return this.publicationType !== 'BOOK';
    },
  },
  publicationYear: { type: Number, min: 1900, max: 2100 },
  volume: String, // JOURNAL
  issue: String, // JOURNAL
  pages: String, // JOURNAL, CONFERENCE, BOOK_CHAPTER
  publisher: String, // BOOK, BOOK_CHAPTER
  editors: String, // BOOK_CHAPTER (comma separated)
  edition: String, // BOOK
  isbn: String, // BOOK, BOOK_CHAPTER
  doi: String,
  indexing: {
    // e.g. ['Scopus', 'SCI', 'WoS']
    type: [String],
    default: [],
  },
  // Only meaningful for CONFERENCE type — left blank for JOURNAL entries.
  conferenceStartDate: Date,
  conferenceEndDate: Date,
  conferenceVenue: String,
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

publicationSchema.index({ title: 'text', venueName: 'text', authors: 'text' });

module.exports = mongoose.model('Publication', publicationSchema);