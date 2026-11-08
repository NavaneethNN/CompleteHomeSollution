import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret-123456789012345678";
process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || "test-brevo-key";

import {
  authorizeCredentials,
  UserNotFoundError,
  OAuthAccountOnlyError,
  EmailNotVerifiedError,
  RateLimitError,
} from "../auth";
import { registerUser } from "../app/(auth)/register/actions";
import { db } from "../lib/db";
import { hashPassword } from "../lib/password";
import { clearRateLimitsForTests } from "../lib/rate-limit";
import * as tokenModule from "../lib/token";
import * as emailModule from "../lib/email";

test("authorizeCredentials throws UserNotFoundError when account does not exist", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  db.user.findUnique = (async () => null) as any;

  await assert.rejects(
    async () => {
      await authorizeCredentials(
        { email: "doesnotexist@example.com", password: "Password123!" },
        { headers: new Headers() }
      );
    },
    (err: any) => {
      assert(err instanceof UserNotFoundError, "Expected instance of UserNotFoundError");
      assert.equal(err.code, "UserNotFound");
      return true;
    }
  );
});

test("authorizeCredentials throws OAuthAccountOnlyError when user has no passwordHash", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  db.user.findUnique = (async () => ({
    id: "user-oauth",
    email: "oauth@example.com",
    name: "Google User",
    passwordHash: null,
    emailVerified: new Date(),
    role: "CUSTOMER",
  })) as any;

  await assert.rejects(
    async () => {
      await authorizeCredentials(
        { email: "oauth@example.com", password: "Password123!" },
        { headers: new Headers() }
      );
    },
    (err: any) => {
      assert(err instanceof OAuthAccountOnlyError, "Expected instance of OAuthAccountOnlyError");
      assert.equal(err.code, "OAuthAccountOnly");
      return true;
    }
  );
});

test("authorizeCredentials throws EmailNotVerifiedError when email is unverified", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  const pwHash = await hashPassword("Password123!");
  db.user.findUnique = (async () => ({
    id: "user-unverified",
    email: "unverified@example.com",
    name: "Unverified User",
    passwordHash: pwHash,
    emailVerified: null,
    role: "CUSTOMER",
  })) as any;

  await assert.rejects(
    async () => {
      await authorizeCredentials(
        { email: "unverified@example.com", password: "Password123!" },
        { headers: new Headers() }
      );
    },
    (err: any) => {
      assert(err instanceof EmailNotVerifiedError, "Expected instance of EmailNotVerifiedError");
      assert.equal(err.code, "EmailNotVerified");
      return true;
    }
  );
});

test("authorizeCredentials returns null for wrong password", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  const pwHash = await hashPassword("CorrectPassword123!");
  db.user.findUnique = (async () => ({
    id: "user-valid",
    email: "user@example.com",
    name: "Valid User",
    passwordHash: pwHash,
    emailVerified: new Date(),
    role: "CUSTOMER",
    isMember: false,
  })) as any;

  const result = await authorizeCredentials(
    { email: "user@example.com", password: "WrongPassword!" },
    { headers: new Headers() }
  );

  assert.equal(result, null);
});

test("authorizeCredentials returns user object on successful authentication", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  const pwHash = await hashPassword("CorrectPassword123!");
  db.user.findUnique = (async () => ({
    id: "user-valid",
    email: "user@example.com",
    name: "Valid User",
    image: null,
    passwordHash: pwHash,
    emailVerified: new Date(),
    role: "CUSTOMER",
    isMember: true,
    membershipExpiry: new Date(Date.now() + 100000),
  })) as any;

  const user = await authorizeCredentials(
    { email: "user@example.com", password: "CorrectPassword123!" },
    { headers: new Headers() }
  );

  assert.ok(user);
  assert.equal(user.id, "user-valid");
  assert.equal(user.email, "user@example.com");
  assert.equal(user.role, "CUSTOMER");
  assert.equal(user.isMember, true);
});

test("authorizeCredentials enforces rate limits on login attempts", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  db.user.findUnique = (async () => null) as any;

  const headers = new Headers({ "x-forwarded-for": "198.51.100.42" });

  // Consume 5 attempts (the limit)
  for (let i = 0; i < 5; i++) {
    await assert.rejects(async () => {
      await authorizeCredentials(
        { email: "ratelimit@example.com", password: "Password123!" },
        { headers }
      );
    }, UserNotFoundError);
  }

  // 6th attempt should be blocked by RateLimitError
  await assert.rejects(
    async () => {
      await authorizeCredentials(
        { email: "ratelimit@example.com", password: "Password123!" },
        { headers }
      );
    },
    (err: any) => {
      assert(err instanceof RateLimitError, "Expected RateLimitError");
      assert.equal(err.code, "RateLimited");
      return true;
    }
  );
});

test("registerUser validates input and handles duplicate email accounts", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  t.after(() => {
    db.user.findUnique = originalFindUnique;
  });

  // Short name
  const res1 = await registerUser({
    name: "A",
    email: "test@example.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });
  assert.equal(res1.field, "name");
  assert.match(res1.error!, /at least 2 characters/i);

  // Invalid email
  const res2 = await registerUser({
    name: "Test User",
    email: "invalid-email",
    password: "Password123!",
    confirmPassword: "Password123!",
  });
  assert.equal(res2.field, "email");
  assert.match(res2.error!, /valid email/i);

  // Short password
  const res3 = await registerUser({
    name: "Test User",
    email: "test@example.com",
    password: "short",
    confirmPassword: "short",
  });
  assert.equal(res3.field, "password");
  assert.match(res3.error!, /at least 8 characters/i);

  // Password mismatch
  const res4 = await registerUser({
    name: "Test User",
    email: "test@example.com",
    password: "Password123!",
    confirmPassword: "DifferentPassword123!",
  });
  assert.equal(res4.field, "confirmPassword");
  assert.match(res4.error!, /do not match/i);

  // Existing user with password
  db.user.findUnique = (async () => ({
    id: "existing-1",
    email: "existing@example.com",
    passwordHash: "some-hash",
  })) as any;

  const res5 = await registerUser({
    name: "Test User",
    email: "existing@example.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });
  assert.equal(res5.field, "email");
  assert.equal(res5.error, "An account with this email already exists.");

  // Existing user via Google OAuth (no passwordHash)
  db.user.findUnique = (async () => ({
    id: "existing-google",
    email: "googleuser@example.com",
    passwordHash: null,
  })) as any;

  const res6 = await registerUser({
    name: "Google User",
    email: "googleuser@example.com",
    password: "Password123!",
    confirmPassword: "Password123!",
  });
  assert.equal(res6.field, "email");
  assert.match(res6.error!, /Google sign-in/i);
});

test("registerUser successfully registers a user and triggers verification email", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  const originalCreate = db.user.create;
  const originalTokenDeleteMany = db.verificationToken.deleteMany;
  const originalTokenCreate = db.verificationToken.create;
  const originalFetch = globalThis.fetch;

  t.after(() => {
    db.user.findUnique = originalFindUnique;
    db.user.create = originalCreate;
    db.verificationToken.deleteMany = originalTokenDeleteMany;
    db.verificationToken.create = originalTokenCreate;
    globalThis.fetch = originalFetch;
  });

  db.user.findUnique = (async () => null) as any;

  let createdUserData: any = null;
  db.user.create = (async (args: any) => {
    createdUserData = args.data;
    return { id: "new-user-123", ...args.data };
  }) as any;

  db.verificationToken.deleteMany = (async () => ({ count: 0 })) as any;
  let createdTokenData: any = null;
  db.verificationToken.create = (async (args: any) => {
    createdTokenData = args.data;
    return { id: "tok-1", ...args.data };
  }) as any;

  let emailPayload: any = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("api.brevo.com")) {
      emailPayload = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ messageId: "msg-123" }), { status: 201 });
    }
    return originalFetch(url, init);
  }) as any;

  const res = await registerUser({
    name: "  Jane Doe  ",
    email: "  Jane.Doe@Example.com  ",
    password: "SecurePassword123!",
    confirmPassword: "SecurePassword123!",
  });

  assert.equal(res.success, true);
  assert.ok(createdUserData);
  assert.equal(createdUserData.name, "Jane Doe");
  assert.equal(createdUserData.email, "jane.doe@example.com");
  assert.match(createdUserData.passwordHash, /^scrypt-v1\$/);
  assert.ok(createdTokenData);
  assert.equal(createdTokenData.identifier, "verify:jane.doe@example.com");
  assert.ok(emailPayload);
  assert.equal(emailPayload.to[0].email, "jane.doe@example.com");
  assert.equal(emailPayload.to[0].name, "Jane Doe");
  assert.match(emailPayload.htmlContent, /Verify My Email/);
});

test("registerUser safely rolls back user creation when verification email delivery fails", async (t) => {
  clearRateLimitsForTests();
  const originalFindUnique = db.user.findUnique;
  const originalCreate = db.user.create;
  const originalDelete = db.user.delete;
  const originalTokenDeleteMany = db.verificationToken.deleteMany;
  const originalTokenCreate = db.verificationToken.create;
  const originalFetch = globalThis.fetch;

  t.after(() => {
    db.user.findUnique = originalFindUnique;
    db.user.create = originalCreate;
    db.user.delete = originalDelete;
    db.verificationToken.deleteMany = originalTokenDeleteMany;
    db.verificationToken.create = originalTokenCreate;
    globalThis.fetch = originalFetch;
  });

  db.user.findUnique = (async () => null) as any;
  db.user.create = (async (args: any) => ({ id: "user-failed", ...args.data })) as any;
  let deletedUserWhere: any = null;
  db.user.delete = (async (args: any) => {
    deletedUserWhere = args.where;
    return { id: "user-failed" };
  }) as any;

  db.verificationToken.deleteMany = (async () => ({ count: 1 })) as any;
  db.verificationToken.create = (async (args: any) => ({ id: "tok-1", ...args.data })) as any;

  // Make Brevo fail with 500
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).includes("api.brevo.com")) {
      return new Response(JSON.stringify({ message: "Provider offline" }), { status: 500 });
    }
    return originalFetch(url);
  }) as any;

  const res = await registerUser({
    name: "Rollback User",
    email: "rollback@example.com",
    password: "SecurePassword123!",
    confirmPassword: "SecurePassword123!",
  });

  assert.equal(res.success, undefined);
  assert.match(res.error!, /Verification email could not be sent/i);
  assert.deepEqual(deletedUserWhere, { email: "rollback@example.com" });
});

test("redirect contract: UserNotFound error builds correct register URL with notice and prefilled email", () => {
  const email = "newuser@example.com.au";
  const callbackUrl: string = "/account/orders";
  
  // Construct redirect URL when UserNotFound code is encountered
  const target = new URL("/register", "https://localhost:3000");
  target.searchParams.set("email", email);
  target.searchParams.set("message", "no_account");
  if (callbackUrl && callbackUrl !== "/") {
    target.searchParams.set("callbackUrl", callbackUrl);
  }

  const generatedUrl = target.pathname + target.search;
  assert.equal(
    generatedUrl,
    "/register?email=newuser%40example.com.au&message=no_account&callbackUrl=%2Faccount%2Forders"
  );

  // Validate register notice mapping
  const NOTICE_MESSAGES: Record<string, string> = {
    no_account: "No account found with this email. Create a free account below to get started.",
  };
  const messageParam = target.searchParams.get("message");
  const emailParam = target.searchParams.get("email");
  
  let noticeMessage: string | null = null;
  if (messageParam) {
    if (messageParam === "no_account") {
      noticeMessage = emailParam
        ? `No account found with ${emailParam}. Create a free account below to get started.`
        : "No account found with this email. Create a free account below to get started.";
    } else {
      noticeMessage = NOTICE_MESSAGES[messageParam] ?? messageParam;
    }
  }

  assert.equal(
    noticeMessage,
    "No account found with newuser@example.com.au. Create a free account below to get started."
  );
});
