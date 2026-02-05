const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const upload = require('../config/multer');

// Criar cliente
router.post('/', upload.array('image', 1), async (req, res) => { 
    try {

      const imageUrls = req.files.map(file => file.path);
  
      const client = new Client({
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        image: imageUrls, 
      });
  
      const savedClient = await client.save();
      res.status(201).json(savedClient);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Listar todos os Clients
router.get('/', async (req, res) => {
    try {
      const clients = await Client.find();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  
  // Obter um Client por ID
router.get('/:id', async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

// Atualizar um Client 
router.put('/:id', upload.array('image', 5), async (req, res) => {
    try {
      const updatedData = {
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
      };
  
      // Se novas imagens forem enviadas, atualize o campo "image"
      if (req.files && req.files.length > 0) {
        const imageUrls = req.files.map(file => file.path);
        updatedData.image = imageUrls;
      }
  
      const updatedClient = await Client.findByIdAndUpdate(req.params.id, updatedData, { new: true });
      if (!updatedClient) return res.status(404).json({ error: 'Cliente não encontrado' });
      res.json(updatedClient);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Excluir um Client
router.delete('/:id', async (req, res) => {
    try {
      const deletedClient = await Client.findByIdAndDelete(req.params.id);
      if (!deletedClient) return res.status(404).json({ error: 'Client não encontrado' });
      res.json({ message: 'Cliente excluído com sucesso!' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  module.exports = router;