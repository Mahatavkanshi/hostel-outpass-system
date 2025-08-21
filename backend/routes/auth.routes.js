const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/auth.controller');
const upload = require('../middlewares/upload'); // ✅ Multer

// Now signup supports uploading "faceImage"
router.post('/signup', upload.single("faceImage"), signup);
router.post('/login', login);

module.exports = router;

