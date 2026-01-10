const express = require('express');
const router = express.Router();
const { register, login, getAllUsers, toggleUser } = require('../controllers/userController');

router.post('/register', register);
router.post('/login', login);
router.get('/', getAllUsers);
router.put('/:id/toggle', toggleUser);

module.exports = router;