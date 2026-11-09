const mongoose = require('mongoose');

const clusterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
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

// A department shouldn't end up with two clusters of the same name
clusterSchema.index({ department: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Cluster', clusterSchema);