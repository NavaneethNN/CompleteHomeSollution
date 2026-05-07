import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "EmailNotVerified";
}

// Log Google OAuth configuration at startup
if (typeof window === "undefined") {
  console.log("[auth] Google OAuth config:", {
    hasClientId: !!process.env.AUTH_GOOGLE_ID,
    hasClientSecret: !!process.env.AUTH_GOOGLE_SECRET,
    authUrl: process.env.AUTH_URL,
  });
}

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
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
        },
      },
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

        if (!user.emailVerified) throw new EmailNotVerifiedError();

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
    async jwt({ token, user, account, trigger }) {
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
      
      // Always fetch fresh user data to reflect profile updates
      if (token["id"]) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token["id"] as string },
            select: { name: true, image: true, role: true, isMember: true },
          });
          if (dbUser) {
            token["name"] = dbUser.name;
            token["image"] = dbUser.image;
            token["role"] = (dbUser.role as UserRole) ?? "CUSTOMER";
            token["isMember"] = dbUser.isMember ?? false;
          }
        } catch (err) {
          console.error("[jwt callback] fresh user lookup failed:", err);
        }
      }
      
      return token;
    },
    session({ session, token }) {
      session.user.id = (token["id"] as string) ?? "";
      session.user.name = (token["name"] as string | null) ?? session.user.name;
      session.user.image = (token["image"] as string | null) ?? session.user.image;
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
