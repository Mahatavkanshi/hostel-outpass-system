const mongoose = require('mongoose');

const approvedOutpassSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: String,
  placeOfVisit: String,
  dateOfLeaving: Date,
  timeOut: String,
  timeIn: String,
  returnTime: Date,
  isOutpassValid: Boolean,
  emergencyContact: String,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  remarks: String,

  // Lateness check (NEW FIELD)
  lateStatus: {
    type: String,
    enum: ['on-time', "late"],
    default: 'on-time'
  },

  // Return check (NEW FIELD)
  isReturn: {
    type: Boolean,
    default: false
  },
    mailed: {
    type: Boolean,
    default: false  // ✅ NEW FIELD: Tracks if email sent
  },

  lateLocation: {
    latitude: String,
    longitude: String,
    capturedAt: Date
  }

}, { timestamps: true });

module.exports = mongoose.model('approvedOutpass', approvedOutpassSchema);



