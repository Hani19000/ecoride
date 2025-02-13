// app.js
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Importation des routes
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Pour utiliser __dirname dans un module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Configuration du moteur de template EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
app.use('/', authRoutes);
app.use('/profile', profileRoutes);

// Page d'accueil
app.get('/', (req, res) => {
  res.render('index', { userId: req.session.userId || null });
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
