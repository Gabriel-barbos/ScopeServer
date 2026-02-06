import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { getSystemDB } from "../../config/databases.js";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["administrator", "validation", "support", "scheduling", "billing"],
    default: "support",
  },
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

let User = null;

const getUserModel = async () => {
  if (User) return User;
  
  const systemDB = await getSystemDB();
  User = systemDB.models.User || systemDB.model("User", userSchema);
  return User;
};

export default getUserModel;