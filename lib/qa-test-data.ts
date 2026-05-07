export type Suite = "login" | "signup";
export type TestStatus = "PENDING" | "PASSED" | "FAILED";

export interface TestCase {
  id: string;
  suite: Suite;
  category: string;
  description: string;
  steps: string;
  expected: string;
}

export const TEST_CASES: TestCase[] = [
  // ─── LOGIN: Form Validation ──────────────────────────────────────────────────
  { id: "L-001", suite: "login", category: "Form Validation", description: "Empty email submission", steps: "Leave email field blank, enter password, click \"Sign In\"", expected: "Email validation error: \"Email is required\"" },
  { id: "L-002", suite: "login", category: "Form Validation", description: "Empty password submission", steps: "Enter valid email, leave password blank, click \"Sign In\"", expected: "Password validation error: \"Password is required\"" },
  { id: "L-003", suite: "login", category: "Form Validation", description: "Invalid email format", steps: "Enter \"invalid-email\" in email field, enter password, click \"Sign In\"", expected: "Email validation error: \"Invalid email address\"" },
  { id: "L-004", suite: "login", category: "Form Validation", description: "Short password (<1 char)", steps: "Enter valid email, enter password with <1 character, click \"Sign In\"", expected: "Password validation error: \"Password is required\"" },
  { id: "L-005", suite: "login", category: "Form Validation", description: "Whitespace-only email", steps: "Enter \"   \" in email field, enter password, click \"Sign In\"", expected: "Email validation error: \"Invalid email address\"" },
  { id: "L-006", suite: "login", category: "Form Validation", description: "Whitespace-only password", steps: "Enter valid email, enter \"   \" in password, click \"Sign In\"", expected: "Password validation error: \"Password is required\"" },
  { id: "L-007", suite: "login", category: "Form Validation", description: "Special characters in email", steps: "Enter \"test+tag@example.com\" in email, valid password, click \"Sign In\"", expected: "Email accepted (valid format)" },
  { id: "L-008", suite: "login", category: "Form Validation", description: "Very long email (100+ chars)", steps: "Enter 100+ character email, valid password, click \"Sign In\"", expected: "Email accepted if valid format" },
  { id: "L-009", suite: "login", category: "Form Validation", description: "Very long password (200+ chars)", steps: "Enter valid email, enter 200+ character password, click \"Sign In\"", expected: "Password accepted (no max length enforced)" },

  // ─── LOGIN: Email/Password ───────────────────────────────────────────────────
  { id: "L-010", suite: "login", category: "Email/Password Login", description: "Successful login with correct credentials", steps: "Enter registered email and correct password, click \"Sign In\"", expected: "Redirect to /account/dashboard, navbar shows user avatar" },
  { id: "L-011", suite: "login", category: "Email/Password Login", description: "Login with unregistered email", steps: "Enter unregistered email, any password, click \"Sign In\"", expected: "Error: \"Invalid email or password\"" },
  { id: "L-012", suite: "login", category: "Email/Password Login", description: "Login with wrong password", steps: "Enter registered email, incorrect password, click \"Sign In\"", expected: "Error: \"Invalid email or password\"" },
  { id: "L-013", suite: "login", category: "Email/Password Login", description: "Case-insensitive email login", steps: "Enter registered email in different case (e.g., User@Example.com), correct password", expected: "Login should work (email comparison is case-insensitive)" },
  { id: "L-014", suite: "login", category: "Email/Password Login", description: "Login with trailing/leading spaces in email", steps: "Enter \" user@example.com \" with spaces, correct password", expected: "Should trim spaces and login if email exists" },
  { id: "L-015", suite: "login", category: "Email/Password Login", description: "Login with OAuth-only user (no password)", steps: "Enter OAuth-only email, any password, click \"Sign In\"", expected: "Error: \"Invalid email or password\" (no password set)" },

  // ─── LOGIN: Google OAuth ─────────────────────────────────────────────────────
  { id: "L-020", suite: "login", category: "Google OAuth", description: "Successful Google Sign In", steps: "Click \"Continue with Google\", authorize with Google account", expected: "Redirect to /account/dashboard, user logged in with Google profile" },
  { id: "L-021", suite: "login", category: "Google OAuth", description: "Google Sign In with new account", steps: "Click \"Continue with Google\", authorize with new Google account not in DB", expected: "User created in DB with OAuth data, redirect to /account/dashboard" },
  { id: "L-022", suite: "login", category: "Google OAuth", description: "Google Sign In with existing account", steps: "Click \"Continue with Google\", authorize with previously used Google account", expected: "Login to existing user account, redirect to /account/dashboard" },
  { id: "L-023", suite: "login", category: "Google OAuth", description: "Google Sign In — user cancels authorization", steps: "Click \"Continue with Google\", click \"Cancel\" on Google consent screen", expected: "Redirect to /login with no error (or OAuthCancelled error)" },
  { id: "L-024", suite: "login", category: "Google OAuth", description: "Google Sign In — user denies email permission", steps: "Click \"Continue with Google\", deny email permission on Google consent screen", expected: "Error: \"AccessDenied\" or similar OAuth error" },
  { id: "L-025", suite: "login", category: "Google OAuth", description: "Google Sign In without Google session", steps: "Click \"Continue with Google\" when not logged into Google", expected: "Google login prompt appears, then OAuth flow proceeds" },
  { id: "L-026", suite: "login", category: "Google OAuth", description: "Google Sign In with Google Workspace account", steps: "Click \"Continue with Google\", authorize with Google Workspace account", expected: "Should work if domain is allowed in Google Cloud Console" },
  { id: "L-027", suite: "login", category: "Google OAuth", description: "Google Sign In with restricted domain", steps: "Click \"Continue with Google\", try to authorize with non-allowed domain", expected: "Error: \"AccessDenied\" or \"Unauthorized domain\"" },
  { id: "L-028", suite: "login", category: "Google OAuth", description: "Google Sign In with multiple Google accounts", steps: "Click \"Continue with Google\", select one account from account chooser", expected: "OAuth flow proceeds with selected account" },

  // ─── LOGIN: Error Handling ───────────────────────────────────────────────────
  { id: "L-030", suite: "login", category: "Error Handling", description: "Network error during login", steps: "Disconnect network, enter credentials, click \"Sign In\"", expected: "Error: \"Something went wrong\" or network error message" },
  { id: "L-031", suite: "login", category: "Error Handling", description: "Server error (500) during login", steps: "(Mock) Server returns 500 on login request", expected: "Error: \"Something went wrong\"" },
  { id: "L-032", suite: "login", category: "Error Handling", description: "Google OAuth callback error", steps: "(Mock) Google returns error in callback", expected: "Error message displayed based on error code" },
  { id: "L-033", suite: "login", category: "Error Handling", description: "Missing AUTH_SECRET env var", steps: "Set AUTH_SECRET to empty, restart dev server, try Google Sign In", expected: "Error: \"Configuration\" — AUTH_SECRET missing" },
  { id: "L-034", suite: "login", category: "Error Handling", description: "Missing Google OAuth credentials", steps: "Unset AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET, restart dev server, try Google Sign In", expected: "Error: \"Google sign-in is not configured yet\"" },
  { id: "L-035", suite: "login", category: "Error Handling", description: "Database connection error during login", steps: "(Mock) DB unavailable during login", expected: "Error: \"Something went wrong\" or database error message" },
  { id: "L-036", suite: "login", category: "Error Handling", description: "Prisma schema mismatch (missing emailVerified)", steps: "Remove emailVerified from User schema, try Google Sign In", expected: "Error: \"Something went wrong\" (DB constraint error)" },

  // ─── LOGIN: UI/UX ────────────────────────────────────────────────────────────
  { id: "L-040", suite: "login", category: "UI / UX", description: "Password show/hide toggle", steps: "Click eye icon in password field", expected: "Password toggles between visible and hidden (••••)" },
  { id: "L-041", suite: "login", category: "UI / UX", description: "\"Remember me\" checkbox", steps: "Check \"Remember me\", login, close browser, reopen", expected: "Session persists (if configured with cookie maxAge)" },
  { id: "L-042", suite: "login", category: "UI / UX", description: "\"Forgot password?\" link", steps: "Click \"Forgot password?\" link", expected: "Redirect to password reset page (or show \"coming soon\" message)" },
  { id: "L-043", suite: "login", category: "UI / UX", description: "\"Create account\" link", steps: "Click \"Create account\" link", expected: "Redirect to /register" },
  { id: "L-044", suite: "login", category: "UI / UX", description: "Google button hover state", steps: "Hover over \"Continue with Google\" button", expected: "Visual hover effect (color change, shadow, etc.)" },
  { id: "L-045", suite: "login", category: "UI / UX", description: "Submit button loading state", steps: "Click \"Sign In\" with valid credentials", expected: "Button shows loading spinner or disabled state during API call" },
  { id: "L-046", suite: "login", category: "UI / UX", description: "Form reset on error", steps: "Submit with invalid credentials, then fix and submit again", expected: "Form submits correctly without page reload" },
  { id: "L-047", suite: "login", category: "UI / UX", description: "Responsive design — mobile", steps: "View login page on mobile viewport", expected: "Layout adapts (stacked, full width, etc.)" },
  { id: "L-048", suite: "login", category: "UI / UX", description: "Responsive design — tablet", steps: "View login page on tablet viewport", expected: "Layout adapts appropriately" },
  { id: "L-049", suite: "login", category: "UI / UX", description: "Keyboard navigation (Tab)", steps: "Use Tab to navigate form fields", expected: "Focus moves logically through form" },
  { id: "L-050", suite: "login", category: "UI / UX", description: "Enter key to submit", steps: "Enter email and password, press Enter", expected: "Form submits (same as clicking \"Sign In\")" },

  // ─── LOGIN: Security ─────────────────────────────────────────────────────────
  { id: "L-060", suite: "login", category: "Security", description: "SQL injection attempt in email", steps: "Enter `' OR '1'='1` as email, any password, click \"Sign In\"", expected: "Login fails, no SQL injection vulnerability" },
  { id: "L-061", suite: "login", category: "Security", description: "XSS attempt in email", steps: "Enter `<script>alert(1)</script>@example.com` as email", expected: "Input sanitized/escaped, no script execution" },
  { id: "L-062", suite: "login", category: "Security", description: "Brute force protection", steps: "Attempt login with wrong password 5+ times in quick succession", expected: "Account locked or rate limited after threshold" },
  { id: "L-063", suite: "login", category: "Security", description: "Session cookie — HttpOnly flag", steps: "Login, inspect browser cookies", expected: "Session cookie has HttpOnly flag" },
  { id: "L-064", suite: "login", category: "Security", description: "Session cookie — Secure flag", steps: "Login over HTTPS, inspect cookies", expected: "Session cookie has Secure flag" },
  { id: "L-065", suite: "login", category: "Security", description: "CSRF token validation", steps: "Submit login form without CSRF token", expected: "Request rejected" },
  { id: "L-066", suite: "login", category: "Security", description: "Password hashing in DB", steps: "Check DB after user registration", expected: "Password is hashed, not stored in plain text" },

  // ─── LOGIN: Redirect/Callback ────────────────────────────────────────────────
  { id: "L-070", suite: "login", category: "Redirect / Callback", description: "Redirect after login with callbackUrl", steps: "Navigate to /account/orders (protected), redirect to /login, login", expected: "Redirect back to /account/orders after successful login" },
  { id: "L-071", suite: "login", category: "Redirect / Callback", description: "Default redirect after login", steps: "Navigate to /login, login with no callbackUrl", expected: "Redirect to /account/dashboard (default)" },
  { id: "L-072", suite: "login", category: "Redirect / Callback", description: "Redirect with invalid/external callbackUrl", steps: "Add ?callbackUrl=//evil.com to login URL, login", expected: "Should redirect to safe default, ignore external URL" },
  { id: "L-073", suite: "login", category: "Redirect / Callback", description: "Google OAuth redirect mismatch", steps: "Change AUTH_URL to different port, try Google Sign In", expected: "Error: \"Configuration\" or redirect_uri mismatch" },

  // ─── SIGNUP: Form Validation ─────────────────────────────────────────────────
  { id: "S-001", suite: "signup", category: "Form Validation", description: "Empty name submission", steps: "Leave name blank, fill other fields, click \"Create Account\"", expected: "Validation error: \"Name is required\"" },
  { id: "S-002", suite: "signup", category: "Form Validation", description: "Empty email submission", steps: "Leave email blank, fill other fields, click \"Create Account\"", expected: "Validation error: \"Email is required\"" },
  { id: "S-003", suite: "signup", category: "Form Validation", description: "Empty password submission", steps: "Leave password blank, fill other fields, click \"Create Account\"", expected: "Validation error: \"Password is required\"" },
  { id: "S-004", suite: "signup", category: "Form Validation", description: "Empty confirm password", steps: "Fill name, email, password, leave confirm blank, click \"Create Account\"", expected: "Validation error: \"Please confirm your password\"" },
  { id: "S-005", suite: "signup", category: "Form Validation", description: "Invalid email format", steps: "Enter \"invalid-email\" in email field", expected: "Validation error: \"Invalid email address\"" },
  { id: "S-006", suite: "signup", category: "Form Validation", description: "Weak password — too short (<8 chars)", steps: "Enter password with <8 characters", expected: "Password strength meter shows \"Weak\" or validation error" },
  { id: "S-007", suite: "signup", category: "Form Validation", description: "Weak password — no uppercase", steps: "Enter password with only lowercase letters", expected: "Password strength meter shows \"Weak\"" },
  { id: "S-008", suite: "signup", category: "Form Validation", description: "Weak password — no lowercase", steps: "Enter password with only uppercase letters", expected: "Password strength meter shows \"Weak\"" },
  { id: "S-009", suite: "signup", category: "Form Validation", description: "Weak password — no number", steps: "Enter password with only letters", expected: "Password strength meter shows \"Weak\"" },
  { id: "S-010", suite: "signup", category: "Form Validation", description: "Weak password — no special character", steps: "Enter password with only letters and numbers", expected: "Password strength meter shows \"Weak\"" },
  { id: "S-011", suite: "signup", category: "Form Validation", description: "Strong password", steps: "Enter password with uppercase, lowercase, number, special char, 8+ chars", expected: "Password strength meter shows \"Strong\"" },
  { id: "S-012", suite: "signup", category: "Form Validation", description: "Passwords do not match", steps: "Enter different passwords in password and confirm fields", expected: "Validation error: \"Passwords do not match\"" },
  { id: "S-013", suite: "signup", category: "Form Validation", description: "Terms checkbox unchecked", steps: "Fill all fields, leave terms checkbox unchecked, click \"Create Account\"", expected: "Validation error: \"You must agree to the terms\"" },
  { id: "S-014", suite: "signup", category: "Form Validation", description: "Very long name (100+ chars)", steps: "Enter 100+ character name", expected: "Should accept or show max length error" },
  { id: "S-015", suite: "signup", category: "Form Validation", description: "Name with special/unicode characters", steps: "Enter name with accents or special chars (e.g., \"José María\")", expected: "Should accept valid Unicode characters" },

  // ─── SIGNUP: Email/Password Registration ────────────────────────────────────
  { id: "S-020", suite: "signup", category: "Email/Password Registration", description: "Successful registration with valid data", steps: "Enter valid name, email, strong password, confirm, check terms, click \"Create Account\"", expected: "Account created, success message, redirect to /account/dashboard" },
  { id: "S-021", suite: "signup", category: "Email/Password Registration", description: "Registration with already registered email", steps: "Enter email that already exists in DB", expected: "Error: \"Email already registered\"" },
  { id: "S-022", suite: "signup", category: "Email/Password Registration", description: "Case-variant of existing email", steps: "Enter existing email with different case (e.g., User@Example.com vs user@example.com)", expected: "Error: \"Email already registered\" (case-insensitive check)" },
  { id: "S-023", suite: "signup", category: "Email/Password Registration", description: "Trailing/leading spaces in email", steps: "Enter \" user@example.com \" with spaces", expected: "Should trim and check if email exists" },
  { id: "S-024", suite: "signup", category: "Email/Password Registration", description: "Password hashing verification", steps: "Register new user, check DB", expected: "Password is hashed, not stored in plain text" },
  { id: "S-025", suite: "signup", category: "Email/Password Registration", description: "User role default", steps: "Register new user, check DB", expected: "User role defaults to \"CUSTOMER\"" },
  { id: "S-026", suite: "signup", category: "Email/Password Registration", description: "isMember default", steps: "Register new user, check DB", expected: "isMember defaults to false" },
  { id: "S-027", suite: "signup", category: "Email/Password Registration", description: "emailVerified default", steps: "Register new user, check DB", expected: "emailVerified is null (not verified)" },

  // ─── SIGNUP: Google OAuth Registration ──────────────────────────────────────
  { id: "S-030", suite: "signup", category: "Google OAuth Registration", description: "Google Sign In with new account", steps: "Click \"Continue with Google\", authorize with new Google account not in DB", expected: "User created in DB with Google profile data, redirect to /account/dashboard" },
  { id: "S-031", suite: "signup", category: "Google OAuth Registration", description: "Google Sign In links to existing email account", steps: "Register with email/password first, then Google Sign In with same email", expected: "Accounts should link (allowDangerousEmailAccountLinking: true)" },
  { id: "S-032", suite: "signup", category: "Google OAuth Registration", description: "Name from Google profile", steps: "Authorize with Google account that has name", expected: "User name in DB matches Google profile name" },
  { id: "S-033", suite: "signup", category: "Google OAuth Registration", description: "Email from Google profile", steps: "Authorize with Google account", expected: "User email in DB matches Google profile email" },
  { id: "S-034", suite: "signup", category: "Google OAuth Registration", description: "Profile image from Google", steps: "Authorize with Google account that has profile photo", expected: "User image in DB stores Google profile photo URL" },
  { id: "S-035", suite: "signup", category: "Google OAuth Registration", description: "Google Sign In without name in profile", steps: "Authorize with Google account that has no name set", expected: "User name should be derived from email or set to null" },
  { id: "S-036", suite: "signup", category: "Google OAuth Registration", description: "Google Workspace account sign-in", steps: "Authorize with Google Workspace account", expected: "Should work if domain is allowed in Google Cloud Console" },

  // ─── SIGNUP: Password Strength Meter ────────────────────────────────────────
  { id: "S-040", suite: "signup", category: "Password Strength Meter", description: "Empty password", steps: "Clear password field", expected: "Strength meter shows \"Very Weak\" or empty" },
  { id: "S-041", suite: "signup", category: "Password Strength Meter", description: "1-5 characters", steps: "Enter 5 character password", expected: "Strength meter shows \"Very Weak\"" },
  { id: "S-042", suite: "signup", category: "Password Strength Meter", description: "6-7 characters", steps: "Enter 7 character password", expected: "Strength meter shows \"Weak\"" },
  { id: "S-043", suite: "signup", category: "Password Strength Meter", description: "8+ chars, only lowercase", steps: "Enter 8 lowercase letters", expected: "Strength meter shows \"Weak\"" },
  { id: "S-044", suite: "signup", category: "Password Strength Meter", description: "8+ chars, lowercase + uppercase", steps: "Enter 8 mixed case letters", expected: "Strength meter shows \"Medium\"" },
  { id: "S-045", suite: "signup", category: "Password Strength Meter", description: "Mixed case + number", steps: "Enter password with letters and numbers", expected: "Strength meter shows \"Medium\" or \"Strong\"" },
  { id: "S-046", suite: "signup", category: "Password Strength Meter", description: "Full complexity password", steps: "Enter password with mixed case + number + special char", expected: "Strength meter shows \"Strong\"" },
  { id: "S-047", suite: "signup", category: "Password Strength Meter", description: "Strength meter color coding", steps: "Enter passwords of varying strength", expected: "Color changes (red → yellow → green)" },
  { id: "S-048", suite: "signup", category: "Password Strength Meter", description: "Real-time strength update", steps: "Type password character by character", expected: "Strength meter updates in real-time" },

  // ─── SIGNUP: Error Handling ──────────────────────────────────────────────────
  { id: "S-050", suite: "signup", category: "Error Handling", description: "Network error during registration", steps: "Disconnect network, fill form, click \"Create Account\"", expected: "Error: \"Something went wrong\" or network error message" },
  { id: "S-051", suite: "signup", category: "Error Handling", description: "Server error (500) during registration", steps: "(Mock) Server returns 500 on registration", expected: "Error: \"Something went wrong\"" },
  { id: "S-052", suite: "signup", category: "Error Handling", description: "Database connection error", steps: "(Mock) DB unavailable during registration", expected: "Error: \"Something went wrong\" or database error message" },
  { id: "S-053", suite: "signup", category: "Error Handling", description: "Duplicate key error (email)", steps: "Try to register with email that already exists", expected: "Error: \"Email already registered\"" },
  { id: "S-054", suite: "signup", category: "Error Handling", description: "Prisma schema mismatch (missing passwordHash)", steps: "Remove passwordHash from User schema, try registration", expected: "Error: \"Something went wrong\" (DB constraint error)" },
  { id: "S-055", suite: "signup", category: "Error Handling", description: "Google OAuth callback error", steps: "(Mock) Google returns error in callback", expected: "Error message displayed based on error code" },

  // ─── SIGNUP: UI/UX ───────────────────────────────────────────────────────────
  { id: "S-060", suite: "signup", category: "UI / UX", description: "Password show/hide toggle", steps: "Click eye icon in password field", expected: "Password toggles between visible and hidden" },
  { id: "S-061", suite: "signup", category: "UI / UX", description: "Confirm password show/hide toggle", steps: "Click eye icon in confirm password field", expected: "Confirm password toggles between visible and hidden" },
  { id: "S-062", suite: "signup", category: "UI / UX", description: "Terms checkbox interaction", steps: "Click terms checkbox", expected: "Checkbox toggles checked/unchecked state" },
  { id: "S-063", suite: "signup", category: "UI / UX", description: "\"Already have an account?\" link", steps: "Click \"Sign in\" link", expected: "Redirect to /login" },
  { id: "S-064", suite: "signup", category: "UI / UX", description: "Google button hover state", steps: "Hover over \"Continue with Google\" button", expected: "Visual hover effect" },
  { id: "S-065", suite: "signup", category: "UI / UX", description: "Submit button loading state", steps: "Click \"Create Account\" with valid data", expected: "Button shows loading spinner or disabled state" },
  { id: "S-066", suite: "signup", category: "UI / UX", description: "Form reset on error", steps: "Submit with existing email, then try new email", expected: "Form submits correctly without page reload" },
  { id: "S-067", suite: "signup", category: "UI / UX", description: "Success animation", steps: "Complete registration successfully", expected: "Success message/animation displayed" },
  { id: "S-068", suite: "signup", category: "UI / UX", description: "Responsive design — mobile", steps: "View signup page on mobile viewport", expected: "Layout adapts (stacked, full width)" },
  { id: "S-069", suite: "signup", category: "UI / UX", description: "Responsive design — tablet", steps: "View signup page on tablet viewport", expected: "Layout adapts appropriately" },
  { id: "S-070", suite: "signup", category: "UI / UX", description: "Keyboard navigation (Tab)", steps: "Use Tab to navigate form fields", expected: "Focus moves logically through form" },
  { id: "S-071", suite: "signup", category: "UI / UX", description: "Enter key to submit", steps: "Enter all fields, press Enter", expected: "Form submits (same as clicking \"Create Account\")" },
  { id: "S-072", suite: "signup", category: "UI / UX", description: "Terms link opens in new tab", steps: "Click \"Terms and Conditions\" link", expected: "Opens in new tab/window" },

  // ─── SIGNUP: Security ────────────────────────────────────────────────────────
  { id: "S-080", suite: "signup", category: "Security", description: "SQL injection in email", steps: "Enter `' OR '1'='1` as email", expected: "Registration fails, no SQL injection" },
  { id: "S-081", suite: "signup", category: "Security", description: "XSS in name field", steps: "Enter `<script>alert(1)</script>` as name", expected: "Input sanitized/escaped, no script execution" },
  { id: "S-082", suite: "signup", category: "Security", description: "XSS in email field", steps: "Enter `<script>alert(1)</script>@example.com` as email", expected: "Input sanitized/escaped, no script execution" },
  { id: "S-083", suite: "signup", category: "Security", description: "Password strength enforcement", steps: "Try to submit with weak password", expected: "Should be rejected or show warning" },
  { id: "S-084", suite: "signup", category: "Security", description: "Email verification default state", steps: "Register, check DB", expected: "emailVerified should be null until verified" },
  { id: "S-085", suite: "signup", category: "Security", description: "Rate limiting on registration", steps: "Attempt registration with same email multiple times quickly", expected: "Rate limit after threshold" },
  { id: "S-086", suite: "signup", category: "Security", description: "CSRF token validation", steps: "Submit form without CSRF token", expected: "Request rejected" },

  // ─── SIGNUP: Redirect/Callback ───────────────────────────────────────────────
  { id: "S-090", suite: "signup", category: "Redirect / Callback", description: "Redirect after registration", steps: "Register successfully", expected: "Redirect to /account/dashboard" },
  { id: "S-091", suite: "signup", category: "Redirect / Callback", description: "Google OAuth redirect after registration", steps: "Register via Google Sign In", expected: "Redirect to /account/dashboard" },
  { id: "S-092", suite: "signup", category: "Redirect / Callback", description: "Redirect with callbackUrl", steps: "Navigate to /register?callbackUrl=/account/orders, register", expected: "Redirect to /account/orders after registration" },
  { id: "S-093", suite: "signup", category: "Redirect / Callback", description: "Login link preserves context", steps: "Click \"Sign in\" from registration page", expected: "Redirect to /login with appropriate context" },
];

export function getTestsBysuites(suite: Suite): TestCase[] {
  return TEST_CASES.filter((t) => t.suite === suite);
}

export function getCategoriesForSuite(suite: Suite): string[] {
  const cases = getTestsBysuites(suite);
  return [...new Set(cases.map((t) => t.category))];
}

export const SUITE_META: Record<Suite, { label: string; color: string; accent: string; total: number }> = {
  login: {
    label: "Login Page",
    color: "bg-blue-50 border-blue-200",
    accent: "text-blue-700",
    total: TEST_CASES.filter((t) => t.suite === "login").length,
  },
  signup: {
    label: "Signup Page",
    color: "bg-violet-50 border-violet-200",
    accent: "text-violet-700",
    total: TEST_CASES.filter((t) => t.suite === "signup").length,
  },
};
