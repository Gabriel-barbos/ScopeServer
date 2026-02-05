import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/proxy", async (req, res) => {
  try {
    const { path, method = "GET", body } = req.body;

    if (!path) {
      return res.status(400).json({ error: "Path é obrigatório" });
    }

    let token = req.body.token || req.headers.authorization;

    if (token?.toLowerCase().startsWith("bearer ")) {
      token = token.slice(7);
    }

    if (!token) {
      return res.status(401).json({ error: "Token é obrigatório" });
    }

    const response = await fetch(
      `https://live.mzoneweb.net/mzone62.api${path}`,
      {
        method: method.toUpperCase(),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: ["GET", "DELETE"].includes(method.toUpperCase())
          ? undefined
          : JSON.stringify(body),
      }
    );

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    res.status(response.status).json(data);
  } catch (err) {
    console.error("Erro no proxy:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
