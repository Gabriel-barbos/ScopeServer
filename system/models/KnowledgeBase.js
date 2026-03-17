import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const knowledgeBaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ["conhecimento", "plataforma", "equipamento", null],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Garante que não existam dois documentos com o mesmo mode+category
knowledgeBaseSchema.index({ mode: 1, category: 1 }, { unique: true });

let KnowledgeBase = null;

const getKnowledgeBaseModel = async () => {
  if (KnowledgeBase) return KnowledgeBase;

  const db = await getSystemDB();
  KnowledgeBase =
    db.models.KnowledgeBase || db.model("KnowledgeBase", knowledgeBaseSchema);

  return KnowledgeBase;
};

export default getKnowledgeBaseModel;