import dotenv from 'dotenv';
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt"
import path from "path";
import session from "express-session";
import mongoose from "mongoose";



dotenv.config();

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
app.use(session({
  secret: "tonSecretUltraSecurisé",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 3600000 }
}));

// Sync crédits + exposer user aux vues
app.use(async (req, res, next) => {
  try {
    if (req.session?.user?.id) {
      const creditRes = await db.query(
        'SELECT montant FROM credits WHERE user_id = $1',
        [req.session.user.id]
      );
      if (creditRes.rowCount > 0) {
        req.session.user.credits = creditRes.rows[0].montant;
      } else {
        // filet de sécurité : crée la ligne si absente
        await db.query(
          `INSERT INTO credits (user_id, montant)
           VALUES ($1, 20)
           ON CONFLICT (user_id) DO NOTHING`,
          [req.session.user.id]
        );
        req.session.user.credits = 20;
      }
    }
  } catch (e) {
    console.error("Erreur sync crédits:", e);
  }
  // Toujours exposer user (ou null) aux vues EJS
  res.locals.user = req.session?.user || null;
  next();
});
// Annuler un trajet (par le chauffeur) + REMBOURSEMENT de tous les passagers
app.post('/annuler-trajet', isAuthenticated, async (req, res) => {
  const { trajet_id } = req.body;
  const chauffeurId = req.session.user.id;
  if (!trajet_id) return res.status(400).send('trajet_id requis');

  try {
    await db.query('BEGIN');

    const trajet = await db.query(
      'SELECT id, chauffeur_id FROM trajet WHERE id = $1 FOR UPDATE',
      [trajet_id]
    );
    if (trajet.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.redirect('/mes-trajets?error=trajet_introuvable');
    }
    if (trajet.rows[0].chauffeur_id !== chauffeurId) {
      await db.query('ROLLBACK');
      return res.status(403).send('Non autorisé à annuler ce trajet.');
    }

    const reservations = await db.query(
      `SELECT id, user_id, credits_utilises 
         FROM reservations 
        WHERE trajet_id = $1
        FOR UPDATE`,
      [trajet_id]
    );

    for (const r of reservations.rows) {
      await db.query(
        `UPDATE credits SET montant = montant + $1 WHERE user_id = $2`,
        [r.credits_utilises, r.user_id]
      );
    }

    await db.query('DELETE FROM reservations WHERE trajet_id = $1', [trajet_id]);
    await db.query('DELETE FROM trajet WHERE id = $1', [trajet_id]);
    await db.query('COMMIT');

    return res.redirect('/mes-trajets?success=annulation_trajet');
  } catch (err) {
    console.error('POST /annuler-trajet', err);
    try { await db.query('ROLLBACK'); } catch {}
    return res.status(500).render('error', { message: "Erreur lors de l'annulation du trajet." });
  }
});

// Démarrer un trajet
// Démarrer un trajet
app.post("/demarrer-trajet", isAuthenticated, async (req, res) => {
  const { trajet_id } = req.body;
  try {
    const r = await db.query(
      `UPDATE trajet SET statut = 'en_cours' WHERE id = $1 AND chauffeur_id = $2 AND statut <> 'termine'`,
      [trajet_id, req.session.user.id]
    );
    console.log('demarrer rowCount=', r.rowCount);
    if (!r.rowCount) return res.redirect("/mes-trajets?error=Rien à démarrer");
    res.redirect("/mes-trajets?success=Trajet démarré");
  } catch (e) {
    console.error(e);
    res.redirect("/mes-trajets?error=Impossible de démarrer");
  }
});


// Terminer un trajet
app.post("/terminer-trajet", isAuthenticated, async (req, res) => {
  const { trajet_id } = req.body;
  const userId = req.session.user.id;

  try {
    // 1) Vérif que le trajet existe + appartient au chauffeur connecté
    const tRes = await db.query(
      `SELECT id, statut, chauffeur_id
         FROM trajet
        WHERE id = $1`,
      [trajet_id]
    );

    if (!tRes.rowCount) {
      return res.redirect("/mes-trajets?error=Trajet introuvable");
    }

    const t = tRes.rows[0];

    if (t.chauffeur_id !== userId) {
      return res.redirect("/mes-trajets?error=Tu n'es pas le chauffeur de ce trajet");
    }

    if (t.statut !== 'en_cours') {
      return res.redirect("/mes-trajets?error=Le trajet n'est pas en cours");
    }

    // 2) Mise à jour simple (sans ended_at si la colonne n'existe pas chez toi)
const r = await db.query(
  `UPDATE trajet SET statut = 'termine', ended_at = NOW() WHERE id = $1`,
  [trajet_id]
);


    if (!r.rowCount) {
      return res.redirect("/mes-trajets?error=Aucune ligne mise à jour");
    }

    return res.redirect("/mes-trajets?success=Trajet terminé");
  } catch (err) {
    console.error("terminer-trajet ERROR:", err);
    return res.redirect("/mes-trajets?error=Impossible de terminer (voir logs serveur)");
  }
});





// Annuler une réservation (par le passager) + REMBOURSEMENT
app.post('/annuler-reservation', isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const { trajet_id } = req.body;

  // Protection basique
  if (!trajet_id) return res.status(400).send('trajet_id requis');

  try {
    await db.query('BEGIN');

    // Trouver la réservation du user pour ce trajet
    const resa = await db.query(
      `SELECT id, credits_utilises 
         FROM reservations 
        WHERE trajet_id = $1 AND user_id = $2
        FOR UPDATE`,
      [trajet_id, userId]
    );

    if (resa.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).send('Réservation introuvable');
    }

    const { id: reservationId, credits_utilises } = resa.rows[0];

    // Rembourser
    await db.query(
      `UPDATE credits 
          SET montant = montant + $1 
        WHERE user_id = $2`,
      [credits_utilises, userId]
    );

    // Supprimer la réservation
    await db.query(`DELETE FROM reservations WHERE id = $1`, [reservationId]);

    await db.query('COMMIT');

    // Rafraîchir les crédits en session
    const refresh = await db.query('SELECT montant FROM credits WHERE user_id = $1', [userId]);
    req.session.user.credits = refresh.rows[0].montant;

    return res.redirect('/historique?success=annulation_reservation');
  } catch (err) {
    console.error('Erreur annulation réservation :', err);
    try { await db.query('ROLLBACK'); } catch {}
    return res.status(500).render('error', { message: "Erreur lors de l'annulation de la réservation." });
  }
});

app.post("/avis", isAuthenticated, async (req, res) => {
  const { trajet_id, chauffeur_id, note, commentaire } = req.body;
  const passager_id = req.session.user.id;

  // Sécurité basique
  const intNote = parseInt(note, 10);
  if (Number.isNaN(intNote) || intNote < 1 || intNote > 5) {
    return res.status(400).send("Note invalide");
  }
  if (intNote <= 2 && (!commentaire || !commentaire.trim())) {
    return res.status(400).send("Commentaire requis si la note ≤ 2");
  }

  try {
    // Vérifier que l'utilisateur a bien participé ET que le trajet est terminé
    const check = await db.query(`
      SELECT 1 
      FROM reservations r
      JOIN trajet t ON t.id = r.trajet_id
      WHERE r.trajet_id = $1
        AND r.user_id   = $2
        AND t.statut    = 'termine'
      LIMIT 1
    `, [trajet_id, passager_id]);

    if (!check.rowCount) {
      return res.status(403).send("Vous ne pouvez pas laisser un avis pour ce trajet.");
    }

    // Empêcher le doublon (1 avis par passager/trajet)
    const exists = await Avis.exists({ trajetId: Number(trajet_id), passagerId: passager_id });
    if (exists) {
      return res.redirect("/historique?error=avis_deja_envoye");
    }

    await Avis.create({
      trajetId: Number(trajet_id),
      passagerId: passager_id,
      chauffeurId: Number(chauffeur_id),
      note: intNote,
      commentaire: commentaire || "",
      statut_validation: "en_attente"
    });

    res.redirect("/historique?success=avis_envoye");
  } catch (err) {
    console.error("Erreur enregistrement avis :", err);
    res.status(500).send("Erreur lors de l'envoi de l'avis.");
  }
});



// Valider un avis et mettre à jour les crédits
app.post("/admin/avis/valider", isAuthenticated, async (req, res) => {
  const { avis_id, action } = req.body; // "approuver" | "refuser"

  try {
    const avis = await Avis.findOne({ _id: avis_id, statut_validation: "en_attente" }).lean();
    if (!avis) {
      return res.status(404).send("Avis introuvable ou déjà traité.");
    }

    if (action === "approuver") {
      await Avis.updateOne({ _id: avis_id }, { $set: { statut_validation: "approuve" } });

      // Créditer le chauffeur uniquement si note >= 4
      if (avis.note >= 4) {
        await db.query(
          `UPDATE credits SET montant = montant + 2 WHERE user_id = $1`,
          [avis.chauffeurId]
        );
      }
    } else if (action === "refuser") {
      await Avis.updateOne({ _id: avis_id }, { $set: { statut_validation: "refuse" } });
    } else {
      return res.status(400).send("Action invalide");
    }

    res.redirect("/admin/avis?success=avis_traite");
  } catch (err) {
    console.error("Erreur validation avis :", err);
    res.status(500).send("Erreur lors de la validation de l'avis.");
  }
});

app.post("/reservation/:id/valider", isAuthenticated, async (req, res) => {
  const reservationId = req.params.id;
  try {
    await db.query('BEGIN');

    const resa = await db.query(`
      SELECT r.id, r.user_id, r.trajet_id, r.credits_utilises,
             t.chauffeur_id
      FROM reservations r
      JOIN trajet t ON t.id = r.trajet_id
      WHERE r.id = $1 AND r.user_id = $2
      FOR UPDATE
    `, [reservationId, req.session.user.id]);

    if (!resa.rowCount) {
      await db.query('ROLLBACK');
      return res.redirect("/validations?error=Reservation introuvable");
    }

    const row = resa.rows[0];

    // Marquer la validation
    await db.query(`
      UPDATE reservations
         SET validation_statut = 'valide',
             validation_at = NOW()
       WHERE id = $1
    `, [reservationId]);

    // Créditer le chauffeur immédiatement (release payout)
    await db.query(`
      UPDATE credits SET montant = montant + $1
       WHERE user_id = $2
    `, [row.credits_utilises, row.chauffeur_id]);

    // (Option simple : on insère un payout "released" pour historique)
    await db.query(`
      INSERT INTO payouts (reservation_id, chauffeur_id, montant, statut, resolved_at)
      VALUES ($1, $2, $3, 'released', NOW())
    `, [row.id, row.chauffeur_id, row.credits_utilises]);

    await db.query('COMMIT');
    res.redirect("/validations?success=Validation enregistrée");
  } catch (e) {
    console.error("POST /reservation/:id/valider", e);
    try { await db.query('ROLLBACK'); } catch {}
    res.redirect("/validations?error=Erreur validation");
  }
});

app.post("/reservation/:id/signaler", isAuthenticated, async (req, res) => {
  const reservationId = req.params.id;
  const { note, commentaire } = req.body;

  try {
    if (!note || isNaN(parseInt(note)) || parseInt(note) < 1 || parseInt(note) > 5) {
      return res.redirect("/validations?error=Note invalide");
    }
    if (!commentaire || !commentaire.trim()) {
      return res.redirect("/validations?error=Commentaire requis");
    }

    await db.query('BEGIN');

    const resa = await db.query(`
      SELECT r.id, r.user_id, r.trajet_id, r.credits_utilises,
             t.chauffeur_id
      FROM reservations r
      JOIN trajet t ON t.id = r.trajet_id
      WHERE r.id = $1 AND r.user_id = $2
      FOR UPDATE
    `, [reservationId, req.session.user.id]);

    if (!resa.rowCount) {
      await db.query('ROLLBACK');
      return res.redirect("/validations?error=Reservation introuvable");
    }
    const row = resa.rows[0];

    // Marquer la validation comme signalée
    await db.query(`
      UPDATE reservations
         SET validation_statut = 'signale',
             validation_comment = $2,
             validation_at = NOW()
       WHERE id = $1
    `, [reservationId, commentaire]);

    // Créer l'avis en attente (Mongo)
    await Avis.create({
      trajetId: row.trajet_id,
      passagerId: row.user_id,
      chauffeurId: row.chauffeur_id,
      note: parseInt(note),
      commentaire,
      statut_validation: "en_attente"
    });

    // Mettre le payout "en attente"
    await db.query(`
      INSERT INTO payouts (reservation_id, chauffeur_id, montant, statut)
      VALUES ($1, $2, $3, 'held')
    `, [row.id, row.chauffeur_id, row.credits_utilises]);

    await db.query('COMMIT');
    res.redirect("/validations?success=Signalement enregistré, un employé va examiner votre avis");
  } catch (e) {
    console.error("POST /reservation/:id/signaler", e);
    try { await db.query('ROLLBACK'); } catch {}
    res.redirect("/validations?error=Erreur signalement");
  }
});


import reservationRouter from "./routes/reservation.js";
app.use('/reservation', reservationRouter);

import contactRouter from './routes/contact.js';
app.use('/contact', contactRouter);

import Avis from "./models/avis.js";


app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));


app.get("/validations", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { rows } = await db.query(`
      SELECT r.id AS reservation_id,
             r.trajet_id,
             r.credits_utilises,
             r.validation_statut,
             r.validation_comment,
             t.lieu_depart,
             t.destination,
             t.date_du_trajet,
             t.heure_depart,
             t.statut AS trajet_statut,
             t.chauffeur_id
      FROM reservations r
      JOIN trajet t ON t.id = r.trajet_id
      WHERE r.user_id = $1
        AND t.statut = 'termine'
        AND r.validation_statut = 'en_attente'
      ORDER BY t.date_du_trajet DESC, t.heure_depart DESC
    `, [userId]);

    res.render("validations", { items: rows, user: req.session.user });
  } catch (e) {
    console.error("GET /validations:", e);
    res.status(500).render("error", { message: "Impossible de charger les validations." });
  }
});


// Liste des avis en attente
app.get("/admin/avis", isAuthenticated, async (req, res) => {
  try {
    const avis = await Avis.find({ statut_validation: "en_attente" }).sort({ createdAt: -1 }).lean();
    res.render("admin-avis", { avis, user: req.session.user });
  } catch (e) {
    console.error("GET /admin/avis", e);
    res.status(500).render("error", { message: "Impossible de charger les avis." });
  }
});

// Valider / Refuser un avis
app.post("/admin/avis/valider", isAuthenticated, async (req, res) => {
  const { avis_id, action } = req.body;
  try {
    const avis = await Avis.findOne({ _id: avis_id, statut_validation: "en_attente" }).lean();
    if (!avis) return res.redirect("/admin/avis?error=Avis introuvable");

    if (action === "approuver") {
      await Avis.updateOne({ _id: avis_id }, { $set: { statut_validation: "approuve" } });

      // libérer les payouts en "held"
      await db.query(`
        UPDATE payouts
           SET statut = 'released', resolved_at = NOW()
         WHERE chauffeur_id = $1 AND statut = 'held'
           AND reservation_id IN (
             SELECT r.id FROM reservations r WHERE r.trajet_id = $2
           )
      `, [avis.chauffeurId, avis.trajetId]);

      // créditer le chauffeur pour ces payouts
      const rel = await db.query(`
        SELECT COALESCE(SUM(montant),0) AS total
          FROM payouts
         WHERE chauffeur_id = $1 AND statut = 'released'
           AND reservation_id IN (
             SELECT r.id FROM reservations r WHERE r.trajet_id = $2
           )
      `, [avis.chauffeurId, avis.trajetId]);

      const total = rel.rows[0].total || 0;
      if (total > 0) {
        await db.query(`UPDATE credits SET montant = montant + $1 WHERE user_id = $2`, [total, avis.chauffeurId]);
      }

    } else if (action === "refuser") {
      await Avis.updateOne({ _id: avis_id }, { $set: { statut_validation: "refuse" } });
      // tu peux aussi annuler les payouts si tu veux :
      // await db.query(`UPDATE payouts SET statut='canceled', resolved_at=NOW() WHERE ...`);
    }

    res.redirect("/admin/avis?success=Avis traité");
  } catch (e) {
    console.error("POST /admin/avis/valider", e);
    res.redirect("/admin/avis?error=Erreur traitement");
  }
});




app.get('/historique', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Trajets réservés par l'utilisateur + infos chauffeur + statut du trajet
    const { rows } = await db.query(`
      SELECT 
        r.id                  AS reservation_id,
        r.trajet_id,
        r.credits_utilises,
        r.statut              AS reservation_statut,
        t.lieu_depart,
        t.destination,
        t.date_du_trajet,
        t.heure_depart,
        t.statut              AS trajet_statut,
        t.chauffeur_id
      FROM reservations r
      JOIN trajet t ON t.id = r.trajet_id
      WHERE r.user_id = $1
      ORDER BY t.date_du_trajet DESC, t.heure_depart DESC
    `, [userId]);

    // Pour chaque réservation, vérifier s'il y a déjà un avis en Mongo
    const withAvis = await Promise.all(rows.map(async (r) => {
      const exist = await Avis.exists({ trajetId: r.trajet_id, passagerId: userId });
      return { ...r, avis_deja_donne: !!exist };
    }));

    res.render('historique', { reservations: withAvis, user: req.session.user });
  } catch (err) {
    console.error("❌ Erreur chargement historique :", err);
    res.status(500).render('error', { message: 'Erreur chargement historique' });
  }
});

app.get('/mes-trajets', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

// /mes-trajets
const { rows: trajets } = await db.query(`
  SELECT 
    t.id AS trajet_id,
    t.lieu_depart,
    t.destination,
    t.date_du_trajet,
    t.heure_depart,
    t.prix_par_place,
    t.nombre_de_places,
    t.statut,                                -- <--- IMPORTANT
    COALESCE(COUNT(r.id), 0) AS nb_reservations
  FROM trajet t
  LEFT JOIN reservations r ON r.trajet_id = t.id
  WHERE t.chauffeur_id = $1
  GROUP BY t.id, t.lieu_depart, t.destination, t.date_du_trajet, t.heure_depart, t.prix_par_place, t.nombre_de_places, t.statut
  ORDER BY t.date_du_trajet DESC, t.heure_depart DESC
`, [userId]);


    return res.render('mes-trajets', {
      user: req.session.user,
      trajets,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (e) {
    console.error('GET /mes-trajets FAILED:', e);
    return res.status(500).render('error', { message: "Impossible de charger vos trajets." });
  }
});

// (Supprimé la double déclaration de session ici)
app.use((req, res, next) => {
  console.log("📌 Session actuelle :", req.session);
  next();
});

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

app.get("/confirmation", isAuthenticated, (req, res) => {
  res.render("confirmation", { user: req.session.user });
});

mongoose.connect("mongodb+srv://hani:19000@cluster0.0qgaf9b.mongodb.net/", {
}).then(() => {
  console.log("✅ Connecté à MongoDB");
}).catch((err) => {
  console.error("❌ Erreur MongoDB :", err);
});

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

app.get('/contact', (req, res) => {
  res.render('contact', { user: req.session.user });
});


app.get('/historique', isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  
  // Exemple : si tu stockes les rôles dans la session
  const roles = req.session.user.roles || [];

  const { rows: reservations } = await db.query(`
    SELECT * FROM reservations
    WHERE user_id = $1
  `, [userId]);

  res.render('historique', {
    reservations,
    roles // <-- On envoie à la vue
  });
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

app.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const userCreditsResult = await db.query(
      "SELECT montant FROM credits WHERE user_id = $1",
      [userId]
    );
    const credits = userCreditsResult.rows[0]?.montant || 0;

const reservationsResult = await db.query(`
  SELECT r.id AS reservation_id, r.credits_utilises, r.statut,
         t.lieu_depart, t.destination, t.date_du_trajet, t.heure_depart
  FROM reservations r
  JOIN trajet t ON r.trajet_id = t.id
  WHERE r.user_id = $1
  ORDER BY t.date_du_trajet DESC
`, [userId]);


    res.render("profile", {
      user: req.session.user,
      credits,
      reservations: reservationsResult.rows
    });
  } catch (error) {
    console.error("Erreur chargement profil :", error);
    res.status(500).send("Erreur serveur");
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
    await db.query('BEGIN');

    const exists = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (exists.rowCount) {
      await db.query('ROLLBACK');
      return res.status(400).send("Email déjà utilisé.");
    }

    const hashed = await bcrypt.hash(password, saltRounds);

    const u = await db.query(
      `INSERT INTO users (email, password, nom, prenom, address, departement, ville)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, email, nom, prenom`,
      [email, hashed, nom, prenom, address, departement, ville]
    );

    const userId = u.rows[0].id;

    // Crédits initiaux
    await db.query(
      `INSERT INTO credits (user_id, montant)
       VALUES ($1, 20)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    await db.query('COMMIT');

    // ✅ Regénérer la session (hygiène) puis l’enregistrer AVANT redirection
    req.session.regenerate((err) => {
      if (err) {
        console.error("Erreur regenerate session:", err);
        return res.status(500).send("Erreur session");
      }

      req.session.user = {
        id: userId,
        email: u.rows[0].email,
        nom: u.rows[0].nom,
        prenom: u.rows[0].prenom,
        credits: 20
      };

      req.session.save((err) => {
        if (err) {
          console.error("Erreur save session:", err);
          return res.status(500).send("Erreur session");
        }
        return res.redirect("/profile");
      });
    });

  } catch (err) {
    console.error('Erreur inscription:', err);
    try { await db.query('ROLLBACK'); } catch {}
    return res.status(500).send('Erreur lors de l’inscription');
  }
});




app.get('/api/me', async (req, res) => {
  if (!req.session?.user?.id) return res.json({ user: null });
  const r = await db.query('SELECT montant FROM credits WHERE user_id=$1', [req.session.user.id]);
  const credits = r.rowCount ? r.rows[0].montant : 20;
  res.json({ user: { ...req.session.user, credits } });
});


app.get("/profile", async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    // Récupérer les infos utilisateur + crédits
    const userRes = await db.query(`
      SELECT u.*, COALESCE(c.montant, 0) AS credits
      FROM users u
      LEFT JOIN credits c ON c.user_id = u.id
      WHERE u.id = $1
    `, [req.session.user.id]);

    if (userRes.rowCount === 0) {
      return res.status(404).render("error", { message: "Utilisateur introuvable" });
    }

    const userRow = userRes.rows[0];

    // Mettre à jour la session et res.locals
    req.session.user.credits = userRow.credits;
    res.locals.user = { ...req.session.user, credits: userRow.credits };

    // Récupérer les véhicules
    const vehiculesRes = await db.query(
      "SELECT * FROM vehicule WHERE chauffeur_id = $1",
      [userRow.id]
    );

    res.render("profile", {
      user: userRow,
      vehicules: vehiculesRes.rows
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil:", error);
    res.status(500).render("error", {
      message: "Une erreur est survenue lors de la récupération de votre profil"
    });
  }
});

app.post("/login", async (req, res) => {
  const { username: email, password } = req.body;

  try {
    const result = await db.query(
      `SELECT u.*, COALESCE(c.montant, 20) as credits
       FROM users u
       LEFT JOIN credits c ON u.id = c.user_id
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.render("error", { message: "Utilisateur non trouvé" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("error", { message: "Mot de passe incorrect" });
    }

    // Si pas de ligne dans credits, on en crée une
    await db.query(
      `INSERT INTO credits (user_id, montant)
       VALUES ($1, 20)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Mettre à jour les crédits en session
    req.session.user = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      credits: user.credits
    };

    return res.redirect("/profile");
  } catch (err) {
    console.error("Erreur lors du login :", err);
    return res.render("error", { message: "Erreur lors de la connexion" });
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
  placesRestantes,
  query: req.query
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


app.post("/reserver-trajet", async (req, res) => {
  const { trajetId } = req.body;
  const user = req.session?.user;

  if (!user) {
    return res.redirect("/login");
  }

  try {
    const trajetResult = await db.query("SELECT * FROM trajet WHERE id = $1", [trajetId]);
    const trajet = trajetResult.rows[0];

    if (!trajet) {
      return res.redirect(`/trajets?error=trajet_introuvable`);
    }

    if (trajet.chauffeur_id === user.id) {
      return res.redirect(`/trajets?error=propre_trajet`);
    }

    const credResult = await db.query("SELECT montant FROM credits WHERE user_id = $1", [user.id]);
    const credits = credResult.rows[0]?.montant || 0;

    const prix = parseFloat(trajet.prix_par_place);
    const creditsUtilises = Math.round(prix);

    if (credits < creditsUtilises) {
      return res.redirect(`/trajets?error=credits_insuffisants`);
    }

    // Empêcher une double réservation
    const dejaReserve = await db.query(
      "SELECT 1 FROM reservations WHERE trajet_id = $1 AND user_id = $2",
      [trajetId, user.id]
    );
    if (dejaReserve.rowCount > 0) {
      return res.redirect(`/trajets?error=deja_reserve`);
    }

    // Debug log
    console.log("🚀 Réservation avec :", {
      trajetId,
      userId: user.id,
      creditsUtilises
    });

    await db.query(
      `INSERT INTO reservations (trajet_id, user_id, credits_utilises, statut)
       VALUES ($1, $2, $3, $4)`,
      [trajetId, user.id, creditsUtilises, 'confirmé']
    );

    await db.query(
      "UPDATE credits SET montant = montant - $1 WHERE user_id = $2",
      [creditsUtilises, user.id]
    );

    res.redirect("/confirmation");
  } catch (err) {
    console.error("❌ Erreur lors de la réservation :", err);
    res.status(500).send("Une erreur est survenue lors de la réservation.");
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

async function majStatutsAutomatique() {
  try {
    await db.query(`
      UPDATE trajet
      SET statut = 'termine'
      WHERE statut != 'termine'
      AND (date_du_trajet + heure_depart::interval + interval '1 hour') < NOW()
    `);
    console.log("✅ Statuts trajets mis à jour automatiquement");
  } catch (err) {
    console.error("Erreur mise à jour statuts:", err);
  }
}

setInterval(majStatutsAutomatique, 5 * 60 * 1000);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});