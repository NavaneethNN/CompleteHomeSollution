import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export type UserRole = "ADMIN" | "MEMBER" | "CUSTOMER";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { password } = parsed.data;
        const email = parsed.data.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });

        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email ?? "",
          name: user.name,
          image: user.image,
          role: user.role as UserRole,
          isMember: user.isMember,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token["id"] = user.id;
        token["role"] = user.role ?? "CUSTOMER";
        token["isMember"] = user.isMember ?? false;
      }
      if (account?.provider === "google" && token.email) {
        try {
          const dbUser = await db.user.findUnique({
            where: { email: token.email },
            select: { id: true, role: true, isMember: true },
          });
          if (dbUser) {
            token["id"] = dbUser.id;
            token["role"] = (dbUser.role as UserRole) ?? "CUSTOMER";
            token["isMember"] = dbUser.isMember ?? false;
          }
        } catch (err) {
          console.error("[jwt callback] db lookup failed:", err);
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = (token["id"] as string) ?? "";
      session.user.role = (token["role"] as UserRole) ?? "CUSTOMER";
      session.user.isMember = (token["isMember"] as boolean) ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      isMember: boolean;
    };
  }
}

declare module "next-auth" {
  interface User {
    role?: UserRole;
    isMember?: boolean;
  }
}
