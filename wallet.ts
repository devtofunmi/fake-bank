import { db } from "./db";
import { wallets, transactions } from "./schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// 3.7 Safe Wallet Transfer
export async function transferMoney(senderUserId: string, receiverUserId: string, amount: string) {
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) throw new Error("Amount must be positive");

    return await db.transaction(async (tx) => {
        // 1. Lock and fetch sender wallet
        // We use .for("update") to prevent other transactions from touching this balance
        const [senderWallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, senderUserId))
            .for("update");

        if (!senderWallet) throw new Error("Sender wallet not found");

        const senderBalance = parseFloat(senderWallet.balance || "0");
        if (senderBalance < amountNum) {
            throw new Error("Insufficient funds");
        }

        // 2. Lock and fetch receiver wallet
        const [receiverWallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, receiverUserId))
            .for("update");

        if (!receiverWallet) throw new Error("Receiver wallet not found");

        // 3. Create debit transaction (The Ledger Truth)
        const reference = `TRF-${randomUUID()}`;
        await tx.insert(transactions).values({
            walletId: senderWallet.id,
            type: "debit",
            amount: amount,
            reference: reference,
        });

        // 4. Create credit transaction (The Ledger Truth)
        await tx.insert(transactions).values({
            walletId: receiverWallet.id,
            type: "credit",
            amount: amount,
            reference: reference + "-CREDIT", // Unique reference for credit part
        });

        // 5. Update balances (The Cache)
        await tx
            .update(wallets)
            .set({
                balance: sql`${wallets.balance} - ${amount}`,
            })
            .where(eq(wallets.id, senderWallet.id));

        await tx
            .update(wallets)
            .set({
                balance: sql`${wallets.balance} + ${amount}`,
            })
            .where(eq(wallets.id, receiverWallet.id));

        return { reference };
    });
}

// 3.9 Funding Wallet (Deposit)
export async function depositMoney(userId: string, amount: string, reference: string) {
    return await db.transaction(async (tx) => {
        // 3.10 Idempotency: Check if this reference has already been processed
        const existingTx = await tx.query.transactions.findFirst({
            where: eq(transactions.reference, reference),
        });

        if (existingTx) {
            // Already processed, return success (Idempotent)
            return existingTx;
        }

        // Lock wallet
        const [wallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .for("update");

        if (!wallet) throw new Error("Wallet not found");

        // Log transaction
        await tx.insert(transactions).values({
            walletId: wallet.id,
            type: "credit",
            amount: amount,
            reference,
        });

        // Update balance
        await tx
            .update(wallets)
            .set({
                balance: sql`${wallets.balance} + ${amount}`,
            })
            .where(eq(wallets.id, wallet.id));

        return { message: "Deposit successful" };
    });
}

// Helper to get wallet balance
export async function getWallet(userId: string) {
    return await db.query.wallets.findFirst({
        where: eq(wallets.userId, userId),
    });
}