const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  collegeId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['student', 'warden', 'gatekeeper'],
    default: 'student'
  },
  isVerified: { type: Boolean, default: false },

  // 🆕 New field for storing face image
  faceImage: {
    type: String, // we'll store file path or filename
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

