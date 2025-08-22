const mongoose = require('mongoose');

// example snippet inside your mongoose schema
const userSchema = new mongoose.Schema({
  // existing fields...
  name: String,
  collegeId: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  isVerified: { type: Boolean, default: false },

  // NEW
  faceDescriptors: {
    type: [[Number]], // array of arrays of numbers (each inner array = 128 floats)
    default: []
  },

  faceImage: String // optional existing field
});



module.exports = mongoose.model('User', userSchema);

