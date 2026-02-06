import jwt from "jsonwebtoken";
import getUserModel from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const User = await getUserModel();
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const admin = (req, res, next) => {
  if (req.user?.role === "administrator") {
    return next();
  }
  return res.status(403).json({ message: "Access denied: admin only" });
};
