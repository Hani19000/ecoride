-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100),
    nom VARCHAR(100),
    prenom VARCHAR(100),
    address VARCHAR(100),
    departement VARCHAR(100),
    ville VARCHAR(100),
    role VARCHAR(20) DEFAULT 'passager',
    suspended BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP,
    logged_in BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role ASC NULLS LAST);

-- Table: role
CREATE TABLE IF NOT EXISTS role (
    id SERIAL PRIMARY KEY,
    chauffeur VARCHAR(100) NOT NULL UNIQUE,
    passager VARCHAR(100) NOT NULL UNIQUE
);

-- Table: vehicule
CREATE TABLE IF NOT EXISTS vehicule (
    id SERIAL PRIMARY KEY,
    plaque_immatriculation VARCHAR(100) NOT NULL UNIQUE,
    date_premiere_immatriculation DATE NOT NULL,
    marque VARCHAR(100) NOT NULL,
    modele VARCHAR(100) NOT NULL,
    couleur VARCHAR(100),
    nombre_places_disponibles INT NOT NULL,
    chauffeur_id INT REFERENCES users(id) ON DELETE CASCADE,
    preferences JSON DEFAULT '[]'
);

-- Table: trajet
CREATE TABLE IF NOT EXISTS trajet (
    id SERIAL PRIMARY KEY,
    chauffeur_id INT REFERENCES users(id) ON DELETE CASCADE,
    vehicule_id INT REFERENCES vehicule(id) ON DELETE SET NULL,
    lieu_depart VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    date_du_trajet DATE NOT NULL,
    duree_du_trajet TIME,
    nombre_de_places INT NOT NULL,
    prix_par_place NUMERIC(10,2) NOT NULL,
    heure_depart TIME,
    heure_arrivee TIME,
    statut VARCHAR DEFAULT 'confirmé',
    canceled_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- Table: reservations
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    trajet_id INT REFERENCES trajet(id),
    user_id INT REFERENCES users(id),
    date_reservation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    credits_utilises INT NOT NULL,
    statut VARCHAR(20) DEFAULT 'confirmé',
    created_at TIMESTAMP DEFAULT NOW(),
    places INT DEFAULT 1,
    validation_statut TEXT DEFAULT 'en_attente',
    validation_comment TEXT,
    validation_at TIMESTAMPTZ
);

-- Table: preferences_vehicule
CREATE TABLE IF NOT EXISTS preferences_vehicule (
    id SERIAL PRIMARY KEY,
    vehicule_id INT NOT NULL REFERENCES vehicule(id) ON DELETE CASCADE,
    preference VARCHAR(50) NOT NULL
);

-- Table: payouts
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    reservation_id INT REFERENCES reservations(id) ON DELETE CASCADE,
    chauffeur_id INT REFERENCES users(id) ON DELETE CASCADE,
    montant INT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_chauffeur
    ON payouts(chauffeur_id ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_payouts_resa
    ON payouts(reservation_id ASC NULLS LAST);

-- Table: credits
CREATE TABLE IF NOT EXISTS credits (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id),
    montant INT NOT NULL DEFAULT 0
);

-- Table: avis
CREATE TABLE IF NOT EXISTS avis (
    id SERIAL PRIMARY KEY,
    trajet_id INT NOT NULL REFERENCES trajet(id) ON DELETE CASCADE,
    passager_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chauffeur_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note INT CHECK (note >= 1 AND note <= 5),
    commentaire TEXT,
    statut_validation VARCHAR(20) DEFAULT 'en_attente',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, role_id)
);

-- Table: session
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire
    ON session(expire ASC NULLS LAST);
