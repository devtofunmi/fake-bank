import { pgTable, uuid, varchar, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";

// 1. Users Table
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

// 2. Sessions Table
export const sessions = pgTable("sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id)
        .notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

// 3. Wallets Table
export const wallets = pgTable("wallets", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id)
        .unique()
        .notNull(),
    balance: numeric("balance", { precision: 12, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow(),
});

// 4. Transactions Table
export const transactionType = pgEnum("transaction_type", ["credit", "debit"]);

export const transactions = pgTable("transactions", {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
        .references(() => wallets.id)
        .notNull(),
    type: transactionType("type").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reference: varchar("reference", { length: 255 }).unique().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

// 5. Scheduled Jobs Table
export const scheduledJobs = pgTable("scheduled_jobs", {
    id: uuid("id").defaultRandom().primaryKey(),
    type: varchar("type", { length: 100 }).notNull(),
    payload: varchar("payload", { length: 1000 }),
    runAt: timestamp("run_at").notNull(),
    status: varchar("status", { length: 20 }).default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
});

// 6. WhatsApp Accounts Table
export const whatsappAccounts = pgTable("whatsapp_accounts", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id)
        .unique()
        .notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }).unique().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});