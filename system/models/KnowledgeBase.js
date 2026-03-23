import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const knowledgeBaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    mode: {
      type: String,
      enum: ["conhecimento", "plataforma", "equipamento", "acessos", "email", "duvidas"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);


let KnowledgeBase = null;

const getKnowledgeBaseModel = async () => {
  if (KnowledgeBase) return KnowledgeBase;

  const db = await getSystemDB();
  KnowledgeBase =
    db.models.KnowledgeBase || db.model("KnowledgeBase", knowledgeBaseSchema);

  return KnowledgeBase;
};

export default getKnowledgeBaseModel;