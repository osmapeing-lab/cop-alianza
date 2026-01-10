const express = require('express');
const router = express.Router();
const { getHistorial } = require('../controllers/sessionController');

router.get('/', getHistorial);

module.exports = router;