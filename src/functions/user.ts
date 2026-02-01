/**
 * USER MANAGEMENT MODULE
 * 
 * Handles user identity and account persistence. 
 * Every interaction requires a registered user record in the database.
 */
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Validation schema for user creation.
 */
export const createUserSchema = z.object({
  phoneNumber: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Persists a new user record.
 * Triggered on the first message received from a new phone number.
 */
export async function createUser(input: CreateUserInput) {
  const validated = createUserSchema.parse(input);
  const result = await db.insert(users).values({
    phoneNumber: validated.phoneNumber,
    name: validated.name,
    email: validated.email,
    balance: 0, // Initial account balance set to ₦0.00.
  }).returning();
  
  return result[0];
}

export const updateUserSchema = z.object({
  phoneNumber: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export async function updateUser(input: z.infer<typeof updateUserSchema>) {
  const { phoneNumber, name, email } = updateUserSchema.parse(input);
  
  const updates: any = {};
  if (name) updates.name = name;
  if (email) updates.email = email;

  if (Object.keys(updates).length === 0) return null;

  const result = await db.update(users)
    .set(updates)
    .where(eq(users.phoneNumber, phoneNumber))
    .returning();
    
  return result[0];
}

export const lookupUserSchema = z.object({
  phoneNumber: z.string(),
});

export type LookupUserInput = z.infer<typeof lookupUserSchema>;

/**
 * Retrieves a user record by phone number.
 * Used to identify the sender of an incoming message.
 */
export async function lookupUser(input: LookupUserInput) {
  try {
    const validated = lookupUserSchema.parse(input);
    const user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, validated.phoneNumber),
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    // Returns null if user is missing, allowing the caller to initiate registration.
    console.error('Error looking up user:', error);
    return null;
  }
}
