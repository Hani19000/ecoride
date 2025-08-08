import mongoose from "mongoose";


const vehiculeSchema = new mongoose.Schema({
  marque: String,
  modele: String,
  couleur: String,
  plaque: String,
  nombre_places_disponibles: Number,
  preferences: [String]
});

const userSchema = new mongoose.Schema({
  nom: String,
  prenom: String,
  email: { type: String, required: true, unique: true },
  mot_de_passe: { type: String, required: true },
  role: [String],
  credits: { type: Number, default: 20 },
  ville: String,
  departement: String,
  vehicule: vehiculeSchema,
  note_moyenne: Number,
  nombre_trajets: Number,
  date_inscription: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
export default User;