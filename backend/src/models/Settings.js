const mongoose = require('mongoose');

// Singleton document — there is only ever one Settings record. We enforce
// this at the service layer (findOneAndUpdate with upsert) rather than a
// unique index on a constant field, since Mongoose doesn't need extra
// ceremony for a one-row config table.
const settingsSchema = new mongoose.Schema({
  instituteName: {
    type: String,
    required: true,
    default: 'BMSITM',
  },
  vision: String,
  mission: String,
  address: String,
  phone: String,
  email: String,
  website: String,
  socialLinks: {
    twitter: String,
    facebook: String,
    linkedin: String,
    youtube: String,
  },
  editorialBoard: [
    {
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
  ],
  principalName: String,
  principalTitle: {
    type: String,
    default: 'Principal',
  },
  currentVolume: {
    type: Number,
    default: 1,
  },
  currentIssue: {
    type: Number,
    default: 1,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

module.exports = mongoose.model('Settings', settingsSchema);