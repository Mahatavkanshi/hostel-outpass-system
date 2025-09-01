const express = require('express');
const router = express.Router();
const { login, signupWithDescriptor } = require('../controllers/auth.controller');
// multer for legacy file uploads

// existing

router.post('/login', login);

// NEW - JSON descriptor based signup (no multipart)
router.post('/signup-descriptor', signupWithDescriptor);

module.exports = router;

