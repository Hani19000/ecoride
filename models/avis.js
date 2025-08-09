import mongoose from "mongoose";

const AvisSchema = new mongoose.Schema({
  trajetId: { type: Number, required: true, index: true },
  reservationId: { type: Number, required: true, index: true },
  passagerId: { type: Number, required: true, index: true },
  chauffeurId: { type: Number, required: true, index: true },
  note: { type: Number, min: 1, max: 5, required: true },
  commentaire: { type: String, default: "" },
  statut_validation: { type: String, enum: ['en_attente','approuve','refuse'], default: 'en_attente', index: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

AvisSchema.index({ reservationId: 1, passagerId: 1 }, { unique: true });

export default mongoose.model("Avis", AvisSchema);
