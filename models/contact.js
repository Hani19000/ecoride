import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  email: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

export default mongoose.model("Contact", contactSchema);
