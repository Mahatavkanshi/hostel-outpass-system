const express = require('express');
const router = express.Router();
const { updateProfile, getProfile } = require('../controllers/profile.controller');
const auth = require('../middlewares/auth.middleware');

router.use(auth); // all profile routes require login

router.put('/', updateProfile);
router.get('/', getProfile);

module.exports = router;
