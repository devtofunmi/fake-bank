import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { signup, verifyPassword, createSession, deleteSession } from "./auth";
import { transferMoney, depositMoney, getWallet } from "./wallet";
import { handleWhatsAppMessage } from "./whatsapp";
import { whatsappAccounts } from "./schema";
import cron from "node-cron";
import { processScheduledJobs, cleanupSessions } from "./jobs";

const app = express();
app.use(express.json());
app.use(cookieParser());

// 2.6 Session Validation Middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const sessionId = req.cookies.session_id;

    if (!sessionId) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await db.query.sessions.findFirst({
        where: (s, { eq }) => eq(s.id, sessionId),
    });

    if (!session || session.expiresAt < new Date()) {
        // Optionally clear cookie if invalid
        res.clearCookie("session_id");
        return res.status(401).json({ error: "Session expired or invalid" });
    }

    // Attach userId to request for downstream use
    (req as any).userId = session.userId;
    next();
}

// Routes

// 2.3 Signup Route
app.post("/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await signup(email, password);
        res.status(201).json({ message: "User created successfully", userId: user.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 2.4 Login Route
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const session = await createSession(user.id);

        // 2.5 Cookies
        res.cookie("session_id", session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            expires: session.expiresAt,
        });

        res.json({ message: "Logged in successfully" });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 2.7 Logout Route
app.post("/logout", async (req, res) => {
    const sessionId = req.cookies.session_id;
    if (sessionId) {
        await deleteSession(sessionId);
    }
    res.clearCookie("session_id");
    res.json({ message: "Logged out successfully" });
});

// Protected Route Example
app.get("/me", requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { passwordHash: false }
    });
    res.json(user);
});

// Wallet Routes

app.get("/wallet", requireAuth, async (req, res) => {
    const userId = (req as any).userId;
    const wallet = await getWallet(userId);
    res.json(wallet);
});

// Transfer money to another user
app.post("/wallet/transfer", requireAuth, async (req, res) => {
    try {
        const senderId = (req as any).userId;
        const { receiverEmail, amount } = req.body;

        if (!receiverEmail || !amount) {
            return res.status(400).json({ error: "Receiver email and amount required" });
        }

        // Find receiver
        const receiver = await db.query.users.findFirst({
            where: eq(users.email, receiverEmail),
        });

        if (!receiver) {
            return res.status(404).json({ error: "Receiver not found" });
        }

        if (receiver.id === senderId) {
            return res.status(400).json({ error: "Cannot transfer to yourself" });
        }

        const result = await transferMoney(senderId, receiver.id, amount.toString());
        res.json({ message: "Transfer successful", ...result });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Deposit money (Simulating webhook or manual funding)
app.post("/wallet/deposit", requireAuth, async (req, res) => {
    try {
        const userId = (req as any).userId;
        const { amount, reference } = req.body;

        if (!amount || !reference) {
            return res.status(400).json({ error: "Amount and reference required" });
        }

        const result = await depositMoney(userId, amount.toString(), reference);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// WhatsApp Routes

// 4.4 Webhook Endpoint
app.post("/webhook/whatsapp", async (req, res) => {
    try {
        const { from, message } = req.body;

        if (!from || !message) {
            return res.status(400).json({ error: "Missing 'from' or 'message'" });
        }

        const response = await handleWhatsAppMessage(from, message);

        // In a real app, you'd call the WhatsApp API here to send the response back.
        // For now, we'll return it in the response body for testing.
        res.json({ reply: response });
    } catch (error: any) {
        console.error("WhatsApp Webhook Error:", error);
        res.sendStatus(500);
    }
});

// Helper route to link a WhatsApp number (simulating dashboard action)
app.post("/whatsapp/link", requireAuth, async (req, res) => {
    try {
        const userId = (req as any).userId;
        const { phoneNumber } = req.body;

        if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });

        await db.insert(whatsappAccounts).values({
            userId,
            phoneNumber: phoneNumber.replace(/\D/g, ""), // Clean number
        });

        res.json({ message: "WhatsApp account linked successfully" });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;

// Start Cron Jobs
// Run every minute
cron.schedule("* * * * *", () => {
    processScheduledJobs();
});

// Run every hour
cron.schedule("0 * * * *", () => {
    cleanupSessions();
});

app.listen(PORT, () => {
    console.log(`Bank server running on http://localhost:${PORT}`);
});