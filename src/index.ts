/**
 * SYSTEM ORCHESTRATOR
 * 
 * Application entry point. Initializes database connectivity, 
 * starts the WhatsApp gateway, and mounts HTTP endpoints.
 */
import express from 'express';
import { connectDB } from './db';
import { startWhatsAppClient } from './whatsapp/client';
import dotenv from 'dotenv';
import { processAiMessage } from './functions/ai';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Database connection initialization (Neon / PostgreSQL).
connectDB();

// WhatsApp gateway initialization.
const whatsappClient = startWhatsAppClient();

/**
 * OPTIONAL HTTP WEBHOOK
 * Endpoint for manual message simulation or external integration.
 */
app.post('/webhook/whatsapp', async (req, res) => {
  const { from, message } = req.body;
  
  if (!from || !message) {
    return res.status(400).json({ error: 'from and message are required' });
  }

  try {
    // Message processing via AI brain.
    const response = await processAiMessage(from, message);
    
    // Response delivery via initialized WhatsApp client.
    await whatsappClient.sendMessage(`${from}@c.us`, response);
    
    res.json({ success: true, response });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Server listener startup.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
