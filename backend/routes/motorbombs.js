const express = require('express');
const router = express.Router();
const { getAllMotorbombs, toggleMotorbomb, createMotorbomb } = require('../controllers/motorbombController');

router.get('/', getAllMotorbombs);
router.post('/', createMotorbomb);
router.put('/:id/toggle', toggleMotorbomb);

module.exports = router;