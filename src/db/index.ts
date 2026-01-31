/**
 * DATABASE CONNECTION HANDLER
 * 
 * Manages the physical connection to the PostgreSQL database.
 * Uses a connection pool for efficient resource management.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Connection pool to handle multiple simultaneous database requests.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Database instance initialized with the defined schema for type safety and intellisense.
export const db = drizzle(pool, { schema });

/**
 * Ensures connectivity to the database on application startup.
 * Errors trigger a process exit to prevent running without a data source.
 */
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
    process.exit(1); 
  }
};
