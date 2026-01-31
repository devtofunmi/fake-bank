/**
 * BANKING ENGINE
 * 
 * Logic for financial transactions. This module is independent of 
 * transport layers like WhatsApp or AI. It ensures data integrity 
 * and consistency for all money movements.
 */
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * VALIDATION SCHEMAS
 * Input verification using Zod to ensure data correctness before 
 * processing any business logic.
 */
export const transferSchema = z.object({
  senderPhone: z.string(),
  receiverPhone: z.string(),
  amount: z.number().positive(), // Positive numbers only to prevent unauthorized withdrawals via transfer.
});

export type TransferInput = z.infer<typeof transferSchema>;

/**
 * FINANCIAL TRANSFER EXECUTION
 * Handles moving funds between users with atomicity guarantees.
 */
export async function transferMoney(input: TransferInput) {
  // Input validation.
  const { senderPhone, receiverPhone, amount } = transferSchema.parse(input);
  
  // Naira to Kobo conversion. Integers are used for calculation to maintain accuracy.
  const amountInKobo = Math.round(amount * 100);
  
  /**
   * DATABASE TRANSACTION
   * Ensures atomicity: all steps must succeed or the entire operation is rolled back.
   * Protects against partial updates where funds might be lost or duplicated.
   */
  return await db.transaction(async (tx: any) => {
    const sender = await tx.query.users.findFirst({
      where: eq(users.phoneNumber, senderPhone),
    });
    const receiver = await tx.query.users.findFirst({
      where: eq(users.phoneNumber, receiverPhone),
    });
    
    // Integrity checks.
    if (!sender) throw new Error('Sender not found');
    if (!receiver) throw new Error('Receiver not found');
    if (sender.balance < amountInKobo) throw new Error('Insufficient balance');
    
    // Debit sender account.
    await tx.update(users)
      .set({ balance: sql`${users.balance} - ${amountInKobo}` })
      .where(eq(users.phoneNumber, senderPhone));
      
    // Credit receiver account.
    await tx.update(users)
      .set({ balance: sql`${users.balance} + ${amountInKobo}` })
      .where(eq(users.phoneNumber, receiverPhone));
      
    return {
      success: true,
      newBalance: (sender.balance - amountInKobo) / 100, // Balance returned in Naira.
    };
  });
}

export const getBalanceSchema = z.object({
  phoneNumber: z.string(),
});

/**
 * BALANCE RETRIEVAL
 */
export async function getBalance(input: z.infer<typeof getBalanceSchema>) {
  const { phoneNumber } = getBalanceSchema.parse(input);
  
  const user = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
  });
  
  if (!user) throw new Error('User not found');
  
  return {
    balance: user.balance / 100, 
    kobo: user.balance          
  };
}

export const depositSchema = z.object({
  phoneNumber: z.string(),
  amount: z.number().positive(),
});

/**
 * FUND DEPOSIT
 * Logic for adding money to a user account.
 */
export async function depositMoney(input: z.infer<typeof depositSchema>) {
  const { phoneNumber, amount } = depositSchema.parse(input);
  const amountInKobo = Math.round(amount * 100);
  
  const user = await db.query.users.findFirst({
    where: eq(users.phoneNumber, phoneNumber),
  });
  if (!user) throw new Error('User not found');
  
  // Atomic balance update.
  await db.update(users)
    .set({ balance: sql`${users.balance} + ${amountInKobo}` })
    .where(eq(users.phoneNumber, phoneNumber));
  
  return {
    success: true,
    newBalance: (user.balance + amountInKobo) / 100,
  };
}
