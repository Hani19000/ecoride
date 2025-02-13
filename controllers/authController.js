// controllers/authController.js
import * as userModel from '../models/user.js';
import bcrypt from 'bcrypt';

export const showLoginPage = (req, res) => {
  res.render('login', { error: null });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findUserByEmail(email);
  if (user && await bcrypt.compare(password, user.password)) {
    // Sauvegarder l'ID de l'utilisateur dans la session
    req.session.userId = user.id;
    return res.redirect('/profile');
  }
  res.render('login', { error: 'Identifiants invalides' });
};

export const showRegisterPage = (req, res) => {
  res.render('register', { error: null });
};

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ username, email, password: hashedPassword });
    req.session.userId = user.id;
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Erreur lors de l’inscription' });
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.redirect('/');
  });
};
