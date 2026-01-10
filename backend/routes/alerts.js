const express = require('express');
const router = express.Router();
const { getAllAlerts, createAlert } = require('../controllers/alertController');

router.get('/', getAllAlerts);
router.post('/', createAlert);

module.exports = router;