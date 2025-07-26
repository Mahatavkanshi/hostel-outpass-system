const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  contactNumber: String,
  parentContact: String,
  address: String,
  gender: String,
  roomNumber: String,
  emergencyContact: String
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
