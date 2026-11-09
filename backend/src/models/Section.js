const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  cluster: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cluster',
    required: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A cluster shouldn't end up with two sections of the same name
sectionSchema.index({ cluster: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);