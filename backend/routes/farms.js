const express = require('express');
const router = express.Router();
const { getAllFarms, createFarm, updateFarm, toggleFarm, deleteFarm } = require('../controllers/farmController');

router.get('/', getAllFarms);
router.post('/', createFarm);
router.put('/:id', updateFarm);
router.put('/:id/toggle', toggleFarm);
router.delete('/:id', deleteFarm);

module.exports = router;