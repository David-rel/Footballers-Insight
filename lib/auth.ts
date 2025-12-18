import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { pool } from "./db";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const result = await pool.query(
          "SELECT id, email, hashed_password, name, email_verified, role, onboarded FROM users WHERE email = $1",
          [credentials.email as string]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const user = result.rows[0];

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashed_password
        );

        if (!isValid) {
          return null;
        }

        // Update last_online and logged_in_status
        await pool.query(
          "UPDATE users SET last_online = CURRENT_TIMESTAMP, logged_in_status = true WHERE id = $1",
          [user.id]
        );

        return {
          id: user.id, // UUID is already a string
          email: user.email,
          name: user.name,
          role: user.role,
          onboarded: user.onboarded,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role;
        token.onboarded = (user as any).onboarded;
      }
      
      // When session is updated, fetch latest role and onboarded status from DB
      if (trigger === "update" && token.email) {
        const result = await pool.query(
          "SELECT role, onboarded FROM users WHERE email = $1",
          [token.email]
        );
        if (result.rows.length > 0) {
          token.role = result.rows[0].role;
          token.onboarded = result.rows[0].onboarded;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        // ALWAYS fetch latest data from database for session
        const result = await pool.query(
          "SELECT id, name, role, onboarded FROM users WHERE email = $1",
          [token.email as string]
        );
        
        if (result.rows.length > 0) {
          const user = result.rows[0];
          session.user.id = user.id;
          session.user.email = token.email as string;
          session.user.name = user.name;
          (session.user as any).role = user.role;
          (session.user as any).onboarded = user.onboarded;
        } else {
          // Fallback to token if user not found (shouldn't happen)
          session.user.id = token.id as string;
          session.user.email = token.email as string;
          session.user.name = token.name as string;
          (session.user as any).role = token.role;
          (session.user as any).onboarded = token.onboarded;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-email",
  },
  session: {
    strategy: "jwt",
  },
});

