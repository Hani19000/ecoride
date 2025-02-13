// routes/auth.js
import express from 'express';
import {
  showLoginPage,
  login,
  showRegisterPage,
  register,
  logout
} from '../controllers/authController.js';

const router = express.Router();

router.get('/login', showLoginPage);
router.post('/login', login);
router.get('/register', showRegisterPage);
router.post('/register', register);
router.get('/logout', logout);

export default router;
