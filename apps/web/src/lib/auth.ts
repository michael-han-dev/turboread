import { NextAuthOptions } from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import GoogleProvider from "next-auth/providers/google"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

//potentially conflicting as this may not be s3.
const client = postgres(process.env.DATABASE_URL!)
const authDb = drizzle(client)

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(authDb),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
} 