import express from "express";
import getDestinatarioModel from "../models/Destinatario.js";
const router = express.Router();

// Função para limpar CPF/CNPJ/CEP
const cleanNumber = (str) => (str ? str.replace(/\D/g, "") : "");

// Criar destinatário
router.post("/", async (req, res) => {
  try {
    const {
      nome, cpf, cnpj, ie, indicadorIe,
      endereco, numero, complemento, bairro,
      cidade, estado, cep, ...rest
    } = req.body;

    const Destinatario = await getDestinatarioModel();

    if (cpf && !cnpj) {
      const camposObrigatoriosPF = [nome, cpf, endereco, numero, complemento, bairro, cidade, estado, cep];
      if (camposObrigatoriosPF.some(c => !c || c.trim() === "")) {
        return res.status(400).json({ error: "Campos obrigatórios para PF estão faltando" });
      }

      const novoDest = new Destinatario({
        nome, cpf: cleanNumber(cpf),
        indicadorIe: "Não Contribuinte", cnpj: "", ie: "",
        endereco, numero, complemento, bairro,
        cidade, estado, cep: cleanNumber(cep), ...rest
      });
      await novoDest.save();
      return res.status(201).json(novoDest);

    } else if (cnpj && !cpf) {
      const camposObrigatoriosPJ = [nome, cnpj, ie, endereco, numero, complemento, bairro, cidade, estado, cep, indicadorIe];
      if (camposObrigatoriosPJ.some(c => !c || c.trim() === "")) {
        return res.status(400).json({ error: "Campos obrigatórios para PJ estão faltando" });
      }

      const novoDest = new Destinatario({
        nome, cnpj: cleanNumber(cnpj), ie,
        indicadorIe: indicadorIe || "Contribuinte do ICMS", cpf: "",
        endereco, numero, complemento, bairro,
        cidade, estado, cep: cleanNumber(cep), ...rest
      });
      await novoDest.save();
      return res.status(201).json(novoDest);

    } else {
      return res.status(400).json({ error: "Informe CPF (PF) ou CNPJ + IE (PJ)" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar destinatário" });
  }
});


// Listar todos
router.get("/", async (req, res) => {
  try {
    const { cpfCnpj, cep } = req.query;
    
    // Se tiver parâmetros de busca (verificação)
    if (cpfCnpj && cep) {
      const query = {
        cep: cep,
        $or: [
          { cpf: cpfCnpj },
          { cnpj: cpfCnpj }
        ]
      };
      
      const Destinatario = await getDestinatarioModel();
      const destinatarios = await Destinatario.find(query);
      return res.json(destinatarios);
    }
    
    // Busca geral (listar todos)
    const Destinatario = await getDestinatarioModel();
    const destinatarios = await Destinatario.find();
    res.json(destinatarios);
  } catch (error) {
    console.error("Erro ao buscar destinatários:", error);
    res.status(500).json({ message: "Erro ao buscar destinatários", error: error.message });
  }
});



// Buscar destinatário específico por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const Destinatario = await getDestinatarioModel();
    const destinatario = await Destinatario.findById(id);
    if (!destinatario) return res.status(404).json({ error: "Destinatário não encontrado" });
    res.json(destinatario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar destinatário" });
  }
});

// Deletar destinatário por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const Destinatario = await getDestinatarioModel();
    const deleted = await Destinatario.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Destinatário não encontrado" });
    res.json({ message: "Destinatário deletado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar destinatário" });
  }
});

// Atualizar destinatário parcialmente
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Se CPF, CNPJ ou CEP vierem, limpa os números
    if (updateData.cpf) updateData.cpf = cleanNumber(updateData.cpf);
    if (updateData.cnpj) updateData.cnpj = cleanNumber(updateData.cnpj);
    if (updateData.cep) updateData.cep = cleanNumber(updateData.cep);

    // Atualiza apenas os campos enviados
    const Destinatario = await getDestinatarioModel();
    const updatedDest = await Destinatario.findByIdAndUpdate(id, updateData, {
      new: true, // retorna o documento atualizado
      runValidators: true
    });

    if (!updatedDest) return res.status(404).json({ error: "Destinatário não encontrado" });

    res.json(updatedDest);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar destinatário" });
  }
});


// Atualizar destinatário completo (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nome,
      cpf,
      cnpj,
      ie,
      indicadorIe,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
      ...rest
    } = req.body;

    // Limpa números
    const updateData = {
      nome,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep: cleanNumber(cep),
      ...rest
    };

    // Define campos baseado no tipo
    if (cpf && !cnpj) {
      updateData.cpf = cleanNumber(cpf);
      updateData.cnpj = "";
      updateData.ie = "";
      updateData.indicadorIe = "Não Contribuinte";
    } else if (cnpj && !cpf) {
      updateData.cnpj = cleanNumber(cnpj);
      updateData.ie = ie;
      updateData.indicadorIe = indicadorIe;
      updateData.cpf = "";
    }

    const Destinatario = await getDestinatarioModel();
    const updatedDest = await Destinatario.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!updatedDest) return res.status(404).json({ error: "Destinatário não encontrado" });

    res.json(updatedDest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar destinatário" });
  }
});

export default router;