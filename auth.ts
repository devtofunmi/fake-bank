import bcrypt from "bcrypt";
import { db } from "./db";
import { users, sessions, wallets } from "./schema";
import { eq, lt } from "drizzle-orm";
import { randomUUID } from "crypto";

const saltRounds = 10;

// 2.2 Password Hashing
export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

// 2.3 Signup Flow
export async function signup(email: string, password: string) {
    const passwordHash = await hashPassword(password);

    return await db.transaction(async (tx) => {
        // 1. Create User
        const [user] = await tx.insert(users).values({
            email,
            passwordHash,
        }).returning();

        // 2. Create Wallet (Requirement: One wallet per user)
        await tx.insert(wallets).values({
            userId: user.id,
        });

        return user;
    });
}

// 2.4 Login Flow & Session Creation
export async function createSession(userId: string) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [session] = await db.insert(sessions).values({
        id: sessionId,
        userId,
        expiresAt,
    }).returning();

    return session;
}

// 2.7 Logout
export async function deleteSession(sessionId: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// 2.8 Session Expiration Cleanup (Cron logic)
export async function cleanupExpiredSessions() {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}