import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt"
import path from "path";
import session from "express-session";
import reservationRouter from "./routes/reservation.js";

const saltRounds = 10;
const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "users",
  password: "19000",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use((req, res, next) => {
  console.log("Session actuelle :", req.session);
  next();
});
app.use(session({
  secret: "tonSecretUltraSecurisé", // Change par une clé secrète forte
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 3600000 } // 1h
}));
app.use((req, res, next) => {
  console.log("📌 Session actuelle :", req.session);
  next();
});




// Middleware pour rendre user disponible dans toutes les vues
app.use((req, res, next) => {
  // Ajouter user à res.locals pour le rendre disponible dans toutes les vues
  res.locals.user = req.session.user || null;
  next();
});

// Middleware pour synchroniser les crédits de l'utilisateur
app.use(async (req, res, next) => {
  if (req.session?.user?.id) {
    try {
      const result = await db.query(`
        SELECT COALESCE(c.montant, 20) as credits 
        FROM users u 
        LEFT JOIN credits c ON u.id = c.user_id 
        WHERE u.id = $1
      `, [req.session.user.id]);

      if (result.rows.length > 0) {
        const userCredits = result.rows[0].credits;
      
        // Si les crédits n'existent pas encore, les créer
        if (userCredits === null || userCredits === undefined) {
          await db.query(
            'INSERT INTO credits (user_id, montant) VALUES ($1, 20) ON CONFLICT (user_id) DO NOTHING',
            [req.session.user.id]
          );
          req.session.user.credits = 20;
        } else {
          req.session.user.credits = userCredits;
        }
      

        // Mettre à jour res.locals pour que les crédits soient disponibles dans les vues
        res.locals.user = req.session.user;
      }
    } catch (err) {
      console.error('Erreur lors de la synchronisation des crédits:', err);
    }
  }
  next();
});

app.get("/profile", async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    // Récupérer les informations de l'utilisateur avec ses crédits
    const userResult = await db.query(`
      SELECT u.*, c.montant as credits 
      FROM users u 
      LEFT JOIN credits c ON u.id = c.user_id 
      WHERE u.id = $1
    `, [req.session.user.id]);

    // Récupérer les véhicules de l'utilisateur
    const vehiculesResult = await db.query(
      "SELECT * FROM vehicule WHERE chauffeur_id = $1",
      [req.session.user.id]
    );

    // Mettre à jour les crédits dans la session
    req.session.user.credits = userResult.rows[0].credits || 0;

    res.render("profile", {
      user: userResult.rows[0],
      vehicules: vehiculesResult.rows
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error);
    res.status(500).render("error", {
      message: "Une erreur est survenue lors de la récupération de votre profil"
    });
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const { username: email, password, nom, prenom, address, departement, ville } = req.body;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      return res.send("Email already exists. Try logging in.");
    }

    // 🔒 Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      "INSERT INTO users (email, password, nom, prenom, address, departement, ville) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [email, hashedPassword, nom, prenom, address, departement, ville]
    );

    const user = result.rows[0];

    // 🔄 Passer les infos utilisateur à profile.ejs
    res.render("profile.ejs", { user });

  } catch (err) {
    console.log(err);
    res.status(500).send("Erreur serveur");
  }
});

app.post("/api/register", async (req, res) => {
  const { username: email, password, nom, prenom, address, departement, ville } = req.body;
  
  try {
    // Début de la transaction
    await db.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insérer l'utilisateur
    const userResult = await db.query(
      "INSERT INTO users (email, password, nom, prenom, address, departement, ville) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [email, hashedPassword, nom, prenom, address, departement, ville]
    );

    const userId = userResult.rows[0].id;

    // Ajouter les crédits initiaux (20 crédits)
    await db.query(
      "INSERT INTO credits (user_id, montant) VALUES ($1, $2)",
      [userId, 20]
    );

    // Valider la transaction
    await db.query('COMMIT');

    // Créer la session avec les crédits
    req.session.user = {
      id: userId,
      email,
      nom,
      prenom,
      credits: 20
    };

    res.json({ success: true });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ success: false, error: "Erreur lors de l'inscription" });
  }
});

app.post("/login", async (req, res) => {
  const { username: email, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.send("Utilisateur non trouvé");
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send("Mot de passe incorrect");
    }

    // ✅ Stocker l'utilisateur dans la session
    req.session.user = user;
    console.log("Utilisateur connecté :", req.session.user);

    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

app.post("/api/login", async (req, res) => {
  const { username: email, password } = req.body;

  try {
    // Récupérer l'utilisateur et ses crédits
    const result = await db.query(`
      SELECT u.*, COALESCE(c.montant, 20) as credits 
      FROM users u 
      LEFT JOIN credits c ON u.id = c.user_id 
      WHERE u.email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // S'assurer que l'utilisateur a des crédits
    if (!user.credits) {
      // Insérer les crédits initiaux si nécessaire
      await db.query(
        'INSERT INTO credits (user_id, montant) VALUES ($1, 20) ON CONFLICT (user_id) DO NOTHING',
        [user.id]
      );
      user.credits = 20;
    }

    // Créer la session avec les informations de l'utilisateur, y compris les crédits
    req.session.user = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      credits: user.credits
    };

    // Mettre à jour les crédits dans la session
    req.session.save((err) => {
      if (err) {
        console.error("Erreur lors de la sauvegarde de la session:", err);
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

// ✅ Route pour afficher la liste des trajets
app.get("/trajets", async (req, res) => {
  try {
    console.log("Requête SQL:", `
      SELECT t.*, v.marque, v.modele, v.couleur, u.nom, u.prenom
      FROM trajet t
      LEFT JOIN vehicule v ON t.vehicule_id = v.id
      LEFT JOIN users u ON t.chauffeur_id = u.id
      WHERE 1=1
     ORDER BY t.date_du_trajet DESC, t.heure_depart ASC`);
    console.log("Paramètres:", []);

    const result = await db.query(`
      SELECT t.*, v.marque, v.modele, v.couleur, u.nom, u.prenom
      FROM trajet t
      LEFT JOIN vehicule v ON t.vehicule_id = v.id
      LEFT JOIN users u ON t.chauffeur_id = u.id
      WHERE 1=1
     ORDER BY t.date_du_trajet DESC, t.heure_depart ASC`
    );

    res.render("trajets", { 
      trajets: result.rows,
      // user est maintenant automatiquement disponible via res.locals
      searchParams: req.query
    });
  } catch (error) {
    console.error("Erreur serveur:", error);
    res.status(500).render("error", { 
      message: "Une erreur est survenue lors de la récupération des trajets" 
    });
  }
});

app.get("/trajet/creer", async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    // Récupérer les informations du véhicule
    const vehiculeId = req.query.vehicule_id;
    const vehiculeResult = await db.query(
      'SELECT * FROM vehicule WHERE id = $1 AND chauffeur_id = $2',
      [vehiculeId, req.session.user.id]
    );

    if (vehiculeResult.rows.length === 0) {
      return res.status(404).render('error', { 
        message: 'Véhicule non trouvé ou vous n\'êtes pas autorisé à créer un trajet avec ce véhicule' 
      });
    }

    const vehicule = vehiculeResult.rows[0];

    res.render('creer-trajet', {
      user: req.session.user,
      vehicule: vehicule
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des informations du véhicule:', error);
    res.status(500).render('error', { 
      message: 'Une erreur est survenue lors de la récupération des informations du véhicule' 
    });
  }
});

// ✅ Route pour créer un nouveau trajet
app.post("/trajet/creer", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Vous devez être connecté pour créer un trajet" });
  }

  const { 
    vehicule_id, lieu_depart, destination, date_du_trajet, 
    heure_depart, duree_du_trajet, nombre_de_places, prix_par_place 
  } = req.body;
  const chauffeur_id = req.session?.user?.id;

  try {
    const result = await db.query(
      `INSERT INTO trajet (
        lieu_depart, destination, date_du_trajet, heure_depart, 
        duree_du_trajet, nombre_de_places, prix_par_place, 
        chauffeur_id, vehicule_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        lieu_depart, destination, date_du_trajet, heure_depart,
        duree_du_trajet, nombre_de_places, prix_par_place,
        chauffeur_id, vehicule_id
      ]
    );
    res.json({ success: true, trajet_id: result.rows[0].id });
  } catch (err) {
    console.error("Erreur lors de la création du trajet:", err);
    res.status(500).json({ error: "Erreur lors de la création du trajet" });
  }
});

// ✅ Route pour enregistrer les informations du véhicule depuis profile.ejs
app.post("/details", async (req, res) => {
  console.log("Données reçues du formulaire véhicule:", req.body);

  const {
    plaque_immatriculation,
    date_premiere_immatriculation,
    marque,
    modele,
    couleur,
    nombre_places_disponibles,
    preferences
  } = req.body;

  const chauffeur_id = req.session?.user?.id;
  if (!chauffeur_id) {
    return res.status(401).json({ error: "Vous devez être connecté pour enregistrer un véhicule" });
  }

  try {
    // Commencer une transaction
    await db.query('BEGIN');

    // Insérer le véhicule
    const vehiculeResult = await db.query(
      `INSERT INTO vehicule (
        plaque_immatriculation, date_premiere_immatriculation,
        marque, modele, couleur, nombre_places_disponibles,
        chauffeur_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        plaque_immatriculation,
        date_premiere_immatriculation,
        marque,
        modele,
        couleur,
        nombre_places_disponibles,
        chauffeur_id
      ]
    );

    const vehicule_id = vehiculeResult.rows[0].id;

    // Si des préférences sont fournies, les insérer
    if (preferences) {
      const prefsArray = Array.isArray(preferences) ? preferences : [preferences];
      for (const pref of prefsArray) {
        await db.query(
          `INSERT INTO preferences_vehicule (vehicule_id, preference)
           VALUES ($1, $2)`,
          [vehicule_id, pref]
        );
      }
    }

    // Valider la transaction
    await db.query('COMMIT');

    // Rediriger vers la page de création de trajet
    res.redirect(`/trajet/creer?vehicule_id=${vehicule_id}`);
  } catch (err) {
    // En cas d'erreur, annuler la transaction
    await db.query('ROLLBACK');
    console.error("Erreur lors de l'enregistrement du véhicule:", err);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du véhicule" });
  }
});

// Route pour afficher le formulaire de création de trajet
app.get('/trajet/creer', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    // Récupérer les informations du véhicule
    const vehiculeId = req.query.vehicule_id;
    const vehiculeResult = await db.query(
      'SELECT * FROM vehicule WHERE id = $1 AND chauffeur_id = $2',
      [vehiculeId, req.session.user.id]
    );

    if (vehiculeResult.rows.length === 0) {
      return res.status(404).render('error', { 
        message: 'Véhicule non trouvé ou vous n\'êtes pas autorisé à créer un trajet avec ce véhicule' 
      });
    }

    const vehicule = vehiculeResult.rows[0];

    res.render('creer-trajet', {
      user: req.session.user,
      vehicule: vehicule
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des informations du véhicule:', error);
    res.status(500).render('error', { 
      message: 'Une erreur est survenue lors de la récupération des informations du véhicule' 
    });
  }
});

// Route pour traiter la création d'un trajet
app.post('/trajet/creer', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Utilisateur non connecté' });
  }

  const {
    vehicule_id,
    lieu_depart,
    destination,
    date_du_trajet,
    heure_depart,
    duree_du_trajet,
    nombre_de_places,
    prix_par_place
  } = req.body;

  try {
    // Vérifier que le véhicule appartient bien au chauffeur
    const vehiculeCheck = await db.query(
      'SELECT id FROM vehicule WHERE id = $1 AND chauffeur_id = $2',
      [vehicule_id, req.session.user.id]
    );

    if (vehiculeCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'Vous n\'êtes pas autorisé à créer un trajet avec ce véhicule' 
      });
    }

    // Créer le trajet
    const result = await db.query(
      `INSERT INTO trajet (
        chauffeur_id,
        vehicule_id,
        lieu_depart,
        destination,
        date_du_trajet,
        heure_depart,
        duree_du_trajet,
        nombre_de_places,
        prix_par_place
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        req.session.user.id,
        vehicule_id,
        lieu_depart,
        destination,
        date_du_trajet,
        heure_depart,
        duree_du_trajet,
        nombre_de_places,
        prix_par_place
      ]
    );

    console.log("Trajet créé avec succès:", result.rows[0]);

    res.status(201).json({
      message: 'Trajet créé avec succès',
      trajet_id: result.rows[0].id
    });
  } catch (error) {
    console.error('Erreur lors de la création du trajet:', error);
    res.status(500).json({ 
      error: 'Une erreur est survenue lors de la création du trajet' 
    });
  }
});

//détails trajets//

// Débogage de la requête pour vérifier pourquoi le trajet n'est pas trouvé

// Vérification de la réponse HTTP pour comprendre pourquoi "Trajet non trouvé" s'affiche

app.get("/trajet/:id", async (req, res, next) => {
  // Vérifier que l'ID est composé uniquement de chiffres
  if (!/^\d+$/.test(req.params.id)) {
    // Si ce n'est pas le cas, passer au middleware suivant
    return next();
  }

  const trajetId = parseInt(req.params.id, 10);
  console.log("🔍 ID reçu pour le trajet :", trajetId);

  try {
    // Récupérer les détails du trajet
    const trajetResult = await db.query(
      `SELECT t.*, 
              u.nom AS chauffeur_nom, u.prenom AS chauffeur_prenom,
              v.marque, v.modele, v.couleur, v.nombre_places_disponibles,
              v.plaque_immatriculation,
              (
                SELECT json_agg(preference) 
                FROM preferences_vehicule 
                WHERE vehicule_id = v.id
              ) as preferences
       FROM trajet t 
       LEFT JOIN users u ON t.chauffeur_id = u.id
       LEFT JOIN vehicule v ON t.vehicule_id = v.id
       WHERE t.id = $1`,
      [trajetId]
    );

    if (trajetResult.rows.length === 0) {
      return res.render("error", { 
        message: "Le trajet demandé n'existe pas ou a été supprimé."
      });
    }

    const trajet = trajetResult.rows[0];
    console.log("Données du trajet:", trajet);

    let dejaReserve = false;
    // Vérifier si l'utilisateur actuel a déjà réservé ce trajet
    if (req.session?.user?.id) {
      const reservationResult = await db.query(
        `SELECT * FROM reservations 
         WHERE trajet_id = $1 AND user_id = $2`,
        [trajetId, req.session.user.id]
      );
      dejaReserve = reservationResult.rows.length > 0;
    }

    // Compter le nombre de places déjà réservées
    const reservationsResult = await db.query(
      `SELECT COUNT(*) as nombre_reservations 
       FROM reservations
       WHERE trajet_id = $1`,
      [trajetId]
    );

    const placesReservees = parseInt(reservationsResult.rows[0].nombre_reservations) || 0;
    const placesRestantes = trajet.nombre_de_places - placesReservees;

    res.render("details", { 
      trajet,
      user: req.session?.user || null,
      dejaReserve,
      placesRestantes
    });
  } catch (err) {
    console.error("Erreur lors de la récupération des détails du trajet:", err);
    res.render("error", { 
      message: "Une erreur est survenue lors de la récupération des détails du trajet. Veuillez réessayer plus tard."
    });
  }
});

app.get('/details/:id', async (req, res) => {
  try {
    // Récupérer les informations du trajet avec les détails du chauffeur et du véhicule
    const result = await db.query(`
      SELECT 
        t.*,
        u.nom as chauffeur_nom,
        u.prenom as chauffeur_prenom,
        u.email as chauffeur_email,
        u.note as chauffeur_note,
        v.marque,
        v.modele,
        v.couleur,
        v.plaque_immatriculation,
        v.preferences
      FROM trajet t
      JOIN users u ON t.chauffeur_id = u.id
      JOIN vehicule v ON t.chauffeur_id = v.chauffeur_id
      WHERE t.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).render('error', { message: 'Trajet non trouvé' });
    }

    const trajet = result.rows[0];

    // Calculer le nombre de places restantes
    const reservationsResult = await db.query(
      'SELECT COUNT(*) as count FROM reservations WHERE trajet_id = $1',
      [req.params.id]
    );
    
    const placesReservees = parseInt(reservationsResult.rows[0].count);
    trajet.places_restantes = trajet.nombre_de_places - placesReservees;

    // Vérifier si l'utilisateur actuel a déjà réservé ce trajet
    let dejaReserve = false;
    if (req.session.user) {
      const reservationResult = await db.query(
        'SELECT * FROM reservations WHERE trajet_id = $1 AND user_id = $2',
        [req.params.id, req.session.user.id]
      );
      dejaReserve = reservationResult.rows.length > 0;
    }

    res.render('details', { 
      trajet,
      user: req.session.user,
      dejaReserve
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des détails du trajet:', error);
    res.status(500).render('error', { 
      message: 'Une erreur est survenue lors de la récupération des détails du trajet' 
    });
  }
});

app.post("/participer/:id", async (req, res) => {
  if (!req.session.user) {
      return res.redirect("/login");
  }

  const userId = req.session.user.id;
  try {
      const trajetResult = await db.query("SELECT places, prix_par_place, chauffeur_id FROM trajet WHERE id = $1", [req.params.id]);
      if (trajetResult.rows.length === 0) {
          return res.status(404).send("Trajet non trouvé");
      }

      const trajet = trajetResult.rows[0];
      if (trajet.places <= 0) {
          return res.send("Désolé, il n'y a plus de place disponible.");
      }

      const userResult = await db.query("SELECT credits FROM users WHERE id = $1", [userId]);
      const userCredits = userResult.rows[0].credits;

      if (userCredits < trajet.prix_par_place) {
          return res.send("Vous n'avez pas assez de crédits.");
      }

      // Double confirmation
      if (!req.body.confirmation) {
          return res.render("confirmation", { trajet, user: req.session.user });
      }

      // Mise à jour des crédits et places disponibles
      await db.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [trajet.prix_par_place, userId]);
      await db.query("UPDATE trajet SET places = places - 1 WHERE id = $1", [req.params.id]);
      await db.query("INSERT INTO reservations (trajet_id, user_id) VALUES ($1, $2)", [req.params.id, userId]);

      res.redirect("/index");
  } catch (error) {
      console.error("Erreur lors de la réservation :", error);
      res.status(500).send("Erreur serveur");
  }
});

app.get("/trajet/:id", async (req, res, next) => {
  // Vérification de l'ID pour s'assurer qu'il s'agit bien d'un entier
  if (!/^\d+$/.test(req.params.id)) {
    return next(); // Passer au middleware suivant si l'ID est invalide
  }

  const trajetId = parseInt(req.params.id, 10);

  try {
    const trajetResult = await db.query(
      `SELECT t.*, u.nom AS chauffeur_nom, u.prenom AS chauffeur_prenom,
              v.marque, v.modele, v.couleur
       FROM trajet t 
       LEFT JOIN users u ON t.chauffeur_id = u.id
       LEFT JOIN vehicule v ON t.vehicule_id = v.id
       WHERE t.id = $1`,
      [trajetId]
    );

    if (trajetResult.rows.length === 0) {
      return res.status(404).render("error", { message: "Trajet non trouvé" });
    }

    const trajet = trajetResult.rows[0];
    res.render("trajet-details", { trajet });
  } catch (err) {
    console.error("Erreur lors de la récupération des détails du trajet:", err);
    res.status(500).render("error", { message: "Erreur lors de la récupération des détails du trajet" });
  }
});

// Route de déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur lors de la déconnexion:', err);
      return res.status(500).send('Erreur lors de la déconnexion');
    }
    res.redirect('/');
  });
});

// Gestionnaire d'erreur 404 pour les routes non trouvées
app.use((req, res, next) => {
  res.status(404).render("error", { 
    message: "La page que vous recherchez n'existe pas." 
  });
});

// Gestionnaire d'erreur global
app.use((err, req, res, next) => {
  console.error("Erreur serveur:", err);
  res.status(500).render("error", { 
    message: "Une erreur inattendue s'est produite. Veuillez réessayer plus tard." 
  });
});

app.use('/', reservationRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});