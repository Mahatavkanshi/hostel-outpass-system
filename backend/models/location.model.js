const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  outpassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutpassRequest',
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['on-time', 'late'],
    default: 'on-time'
  }
});

module.exports = mongoose.model('LocationLog', locationSchema);
