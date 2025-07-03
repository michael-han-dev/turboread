import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  driver: 'pg',
  dbCredentials: {
    connectionString:process.env.DATABASE_URL!,
  }
} as Config; 