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

// Vérification de la clé secrète
if (!process.env.SESSION_SECRET) {
  console.error("Erreur : La variable d'environnement SESSION_SECRET est manquante.");
  process.exit(1); // Arrête l'exécution si SESSION_SECRET n'est pas défini
}

// Middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true si en prod (HTTPS), false sinon
    httpOnly: true, // Protège contre les attaques XSS
    maxAge: 1000 * 60 * 60 * 24 // Durée de la session : 24h
  }
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

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});

console.log("SESSION_SECRET:", process.env.SESSION_SECRET);
