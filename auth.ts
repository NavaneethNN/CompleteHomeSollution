import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rate-limit";

// Security configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

class EmailNotVerifiedError extends CredentialsSignin {
  code = "EmailNotVerified";
}


export type UserRole = "ADMIN" | "MEMBER" | "CUSTOMER";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Custom error for rate limiting
class RateLimitError extends CredentialsSignin {
  code = "RateLimited";
}

// Custom error for invalid credentials
class InvalidCredentialsError extends CredentialsSignin {
  code = "CredentialsSignin";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
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
      async authorize(credentials, req) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { password } = parsed.data;
        const email = parsed.data.email.toLowerCase().trim();
        
        // Rate limiting check - use IP + email as identifier
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
        const rateLimitKey = `${ip}:${email}`;
        
        const rateLimit = checkRateLimit(rateLimitKey);
        if (rateLimit.blocked) {
          throw new RateLimitError();
        }

        const user = await db.user.findUnique({ where: { email } });

        if (!user || !user.passwordHash) {
          // Record failed attempt even for non-existent users
          recordFailedAttempt(rateLimitKey);
          return null;
        }

        if (!user.emailVerified) {
          throw new CredentialsSignin("EmailNotVerified");
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          // Record failed attempt for wrong password
          recordFailedAttempt(rateLimitKey);
          return null;
        }

        // Reset rate limit on successful login
        resetRateLimit(rateLimitKey);

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
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
        ? "__Secure-authjs.session-token" 
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers: ensure emailVerified is set (Google always provides verified emails)
      if (account?.provider === "google" && user.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { emailVerified: true },
          });
          if (!dbUser?.emailVerified) {
            await db.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            });
          }
        } catch {
          // Silently ignore email verification update failures
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token["id"] = user.id;
        token["role"] = user.role ?? "CUSTOMER";
        token["isMember"] = user.isMember ?? false;
      }
      // Only fetch Google user data if we have a valid email
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
            select: { id: true, name: true, image: true, role: true, isMember: true, emailVerified: true, accounts: { select: { provider: true } } },
          });
          if (dbUser) {
            token["name"] = dbUser.name;
            token["image"] = dbUser.image;
            token["role"] = (dbUser.role as UserRole) ?? "CUSTOMER";
            token["isMember"] = dbUser.isMember ?? false;
            // Backfill emailVerified for existing OAuth users that have NULL
            const isOAuthUser = dbUser.accounts.some((a) => a.provider !== "credentials");
            if (!dbUser.emailVerified && isOAuthUser) {
              await db.user.update({
                where: { id: dbUser.id },
                data: { emailVerified: new Date() },
              });
            }
          } else {
            // User no longer exists in DB — invalidate token to prevent FK errors
            token["id"] = undefined;
            token["role"] = undefined;
            token["isMember"] = undefined;
          }
        } catch {
          // Silently ignore user lookup failures
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
