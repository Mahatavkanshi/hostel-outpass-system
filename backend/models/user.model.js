const mongoose = require('mongoose');

// example snippet inside your mongoose schema
const userSchema = new mongoose.Schema({
  // existing fields...
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

  // NEW
  faceDescriptors: {
    type: [[Number]], // array of arrays of numbers (each inner array = 128 floats)
    default: []
  },

  faceImage: String // optional existing field
});



module.exports = mongoose.model('User', userSchema);

