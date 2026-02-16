const express = require('express');
const router = express.Router();
const {
  getAllMotorbombs,
  toggleMotorbomb,
  createMotorbomb,
  updateMotorbomb,
  deleteMotorbomb,
  getMotorbombStatus
} = require('../controllers/motorbombController');

router.get('/', getAllMotorbombs);
router.get('/status', getMotorbombStatus);
router.post('/', createMotorbomb);
router.put('/:id/toggle', toggleMotorbomb);
router.put('/:id', updateMotorbomb);
router.delete('/:id', deleteMotorbomb);

module.exports = router;