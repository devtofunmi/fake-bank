/**
 * WHATSAPP TRANSPORT GATEWAY
 * 
 * Manages communication between users and the system via WhatsApp.
 * Handles message reception, sender identification, and response delivery.
 */
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { processAiMessage } from '../functions/ai';
import { lookupUser, createUser } from '../functions/user';

export const startWhatsAppClient = () => {
  /**
   * Session persistence using LocalAuth.
   * Saves authentication state to disk to avoid re-scanning QR codes after restarts.
   */
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox'],
    }
  });

  // QR code generation for terminal-based authentication.
  client.on('qr', (qr: string) => {
    console.log('QR RECEIVED: Scan this code to continue');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    console.log('AUTHENTICATED: Session successfully established');
  });

  client.on('auth_failure', (msg: any) => {
    console.error('AUTHENTICATION FAILURE:', msg);
  });

  client.on('loading_screen', (percent: any, message: any) => {
    console.log('LOADING:', percent, message);
  });

  // Ready event triggered upon successful authentication and connection.
  client.on('ready', () => {
    console.log('Client is ready! Listening for messages...');
  });

  /**
   * Incoming message event handler.
   * Primary entry point for user interactions.
   */
  client.on('message', async (msg: any) => {
    // Phone number normalization by removing WhatsApp domain suffix.
    const from = msg.from.replace('@c.us', '');
    
    // Ignore status updates
    if (msg.from.includes('status@broadcast')) return;

    const text = msg.body;

    console.log(`Message from ${from}: ${text}`);

    // USER AUTHENTICATION & INITIALIZATION
    // Verifies user existence; initiates account creation for new users.
    let user = await lookupUser({ phoneNumber: from });
    if (!user) {
      console.log(`Creating new user for ${from}`);
      await createUser({ phoneNumber: from });
    }

    try {
      // INTENT PROCESSING
      // Delegates message interpretation to the AI module.
      const response = await processAiMessage(from, text);
      
      // RESPONSE DELIVERY
      // Sends the generated reply back to the sender via WhatsApp.
      await client.sendMessage(msg.from, response);
    } catch (error) {
      console.error('Error processing message:', error);
      await client.sendMessage(msg.from, 'Sorry, I encountered an error. Please try again later.');
    }
  });

  // Initialization of the WhatsApp client.
  client.initialize();

  return client;
};
