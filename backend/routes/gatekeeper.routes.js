const express = require('express');
const router = express.Router();
const { loginGatekeeper } = require('../controllers/gatekeeper.controller');
const auth = require('../middlewares/auth.middleware');
const restrictTo = require('../middlewares/role.middleware');
const { markStudentReturned, markAllReturned } = require('../controllers/outpass.controller');

// Public (no token)
router.post('/login', loginGatekeeper);

// Protected
router.put('/mark-all-returned', auth, restrictTo('gatekeeper'), markAllReturned);
router.put('/:id', auth, restrictTo('gatekeeper'), markStudentReturned);

module.exports = router;
