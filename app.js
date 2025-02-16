import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt"

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
app.use(express.static("public"));


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
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already exists. Try logging in." });
    } else {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      await db.query(
        "INSERT INTO users (email, password, nom, prenom, address, departement, ville) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [email, hashedPassword, nom, prenom, address, departement, ville]
      );
      res.status(201).json({ message: "User registered successfully!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
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

    // 🔄 Vérification sécurisée avec bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send("Mot de passe incorrect");
    }

    // ✅ Si le mot de passe est correct, rendre le profil
    res.render("profile.ejs", { user });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});



app.post("/api/login", async (req, res) => {
  const { username: email, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        res.json({ message: "Login successful", user });
      } else {
        res.status(401).json({ message: "Incorrect password" });
      }
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("profile", { user: req.session.user });
});

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}