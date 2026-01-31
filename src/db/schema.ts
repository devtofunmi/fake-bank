/**
 * DATABASE SCHEMA - SOURCE OF TRUTH
 * 
 * Defines the structure for the PostgreSQL database. In a banking system, 
 * the database is the final authority. Any transaction must be recorded here 
 * to be considered valid.
 */
import { pgTable, text, timestamp, integer, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // UUID primary key for security and scalability.
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Phone numbers stored as TEXT to preserve leading zeros (e.g., 080).
  // This field is unique to identify users.
  phoneNumber: text('phone_number').notNull().unique(),
  
  name: text('name'),
  
  // Balance stored as INTEGER in KOBO.
  // Using integers instead of floats prevents precision errors common in currency math.
  // ₦100.50 is represented as 10050.
  balance: integer('balance').default(0).notNull(), 
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;