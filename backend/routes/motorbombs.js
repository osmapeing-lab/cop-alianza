const express = require('express');
const router = express.Router();
const { getAllMotorbombs, toggleMotorbomb, createMotorbomb } = require('../controllers/motorbombController');

router.get('/', getAllMotorbombs);
router.post('/', createMotorbomb);
router.put('/:id/toggle', toggleMotorbomb);
router.get('/status', getMotorbombStatus);


module.exports = router;