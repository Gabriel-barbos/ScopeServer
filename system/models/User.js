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

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

let systemDB = null;
let User = null;

const getUserModel = async () => {
  if (User) return User;
  
  if (!systemDB) {
    systemDB = await getSystemDB();
  }
  
  User = systemDB.models.User || systemDB.model("User", userSchema);
  return User;
};

export default getUserModel;