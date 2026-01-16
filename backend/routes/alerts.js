const express = require('express');
const router = express.Router();
const { getAlertas, crearAlerta } = require('../controllers/alertController');

router.get('/', getAlertas);
router.post('/', crearAlerta);

module.exports = router;