# Test Cases — Login & Signup Pages

## Login Page (`/login`)

### Form Validation Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-001 | Empty email submission | Leave email field blank, enter password, click "Sign In" | Email validation error: "Email is required" |
| L-002 | Empty password submission | Enter valid email, leave password blank, click "Sign In" | Password validation error: "Password is required" |
| L-003 | Invalid email format | Enter "invalid-email" in email field, enter password, click "Sign In" | Email validation error: "Invalid email address" |
| L-004 | Short password | Enter valid email, enter password with <1 character, click "Sign In" | Password validation error: "Password is required" |
| L-005 | Whitespace-only email | Enter "   " in email field, enter password, click "Sign In" | Email validation error: "Invalid email address" |
| L-006 | Whitespace-only password | Enter valid email, enter "   " in password, click "Sign In" | Password validation error: "Password is required" |
| L-007 | Special characters in email | Enter "test+tag@example.com" in email, valid password, click "Sign In" | Email accepted (valid format) |
| L-008 | Very long email | Enter 100+ character email, valid password, click "Sign In" | Email accepted if valid format |
| L-009 | Very long password | Enter valid email, enter 200+ character password, click "Sign In" | Password accepted (no max length enforced) |

### Email/Password Login Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-010 | Successful login with correct credentials | Enter registered email and correct password, click "Sign In" | Redirect to `/account/dashboard`, navbar shows user avatar |
| L-011 | Login with unregistered email | Enter unregistered email, any password, click "Sign In" | Error: "Invalid email or password" |
| L-012 | Login with wrong password | Enter registered email, incorrect password, click "Sign In" | Error: "Invalid email or password" |
| L-013 | Login with case-sensitive email | Enter registered email in different case (e.g., User@Example.com), correct password | Login should work (email comparison should be case-insensitive) |
| L-014 | Login with trailing/leading spaces | Enter " user@example.com " with spaces, correct password | Should trim spaces and login if email exists |
| L-015 | Login with user who has no passwordHash (OAuth-only user) | Enter OAuth-only email, any password, click "Sign In" | Error: "Invalid email or password" (no password set) |

### Google OAuth Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-020 | Successful Google Sign In | Click "Continue with Google", authorize with Google account | Redirect to `/account/dashboard`, user logged in with Google profile |
| L-021 | Google Sign In with new Google account | Click "Continue with Google", authorize with new Google account not in DB | User created in DB with OAuth data, redirect to `/account/dashboard` |
| L-022 | Google Sign In with existing Google account | Click "Continue with Google", authorize with previously used Google account | Login to existing user account, redirect to `/account/dashboard` |
| L-023 | Google Sign In — user cancels authorization | Click "Continue with Google", click "Cancel" on Google consent screen | Redirect to `/login` with no error (or OAuthCancelled error) |
| L-024 | Google Sign In — user denies email permission | Click "Continue with Google", deny email permission on Google consent screen | Error: "AccessDenied" or similar OAuth error |
| L-025 | Google Sign In without Google session | Click "Continue with Google" when not logged into Google | Google login prompt appears, then OAuth flow proceeds |
| L-026 | Google Sign In with Google Workspace account | Click "Continue with Google", authorize with Google Workspace (e.g., @completehomesollution.com.au) | Should work if domain is allowed in Google Cloud Console |
| L-027 | Google Sign In with restricted domain (if configured) | Click "Continue with Google", try to authorize with non-allowed domain | Error: "AccessDenied" or "Unauthorized domain" |
| L-028 | Google Sign In with multiple Google accounts | Click "Continue with Google", select one account from account chooser | OAuth flow proceeds with selected account |

### Error Handling Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-030 | Network error during login | Disconnect network, enter credentials, click "Sign In" | Error: "Something went wrong" or network error message |
| L-031 | Server error (500) during login | (Mock) Server returns 500 on login request | Error: "Something went wrong" |
| L-032 | Google OAuth callback error | (Mock) Google returns error in callback | Error message displayed based on error code (Configuration, AccessDenied, etc.) |
| L-033 | Missing AUTH_SECRET env var | Set AUTH_SECRET to empty, restart dev server, try Google Sign In | Error: "Configuration" — AUTH_SECRET missing |
| L-034 | Missing Google OAuth credentials | Unset AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET, restart dev server, try Google Sign In | Error: "Google sign-in is not configured yet" |
| L-035 | Database connection error during login | (Mock) DB unavailable during login | Error: "Something went wrong" or database error message |
| L-036 | Prisma schema mismatch (missing emailVerified) | Remove emailVerified from User schema, try Google Sign In | Error: "Something went wrong" (DB constraint error) |

### UI/UX Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-040 | Password show/hide toggle | Click eye icon in password field | Password toggles between visible and hidden (••••) |
| L-041 | "Remember me" checkbox | Check "Remember me", login, close browser, reopen | Session persists (if configured with cookie maxAge) |
| L-042 | "Forgot password?" link | Click "Forgot password?" link | Redirect to password reset page (or show "coming soon" message) |
| L-043 | "Create account" link | Click "Create account" link | Redirect to `/register` |
| L-044 | Google button hover state | Hover over "Continue with Google" button | Visual hover effect (color change, shadow, etc.) |
| L-045 | Submit button loading state | Click "Sign In" with valid credentials | Button shows loading spinner or disabled state during API call |
| L-046 | Form reset on error | Submit with invalid credentials, then fix and submit again | Form submits correctly without page reload |
| L-047 | Responsive design — mobile | View login page on mobile viewport | Layout adapts (stacked, full width, etc.) |
| L-048 | Responsive design — tablet | View login page on tablet viewport | Layout adapts appropriately |
| L-049 | Keyboard navigation (Tab) | Use Tab to navigate form fields | Focus moves logically through form |
| L-050 | Enter key to submit | Enter email and password, press Enter | Form submits (same as clicking "Sign In") |

### Security Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-060 | SQL injection attempt in email | Enter `' OR '1'='1` as email, any password, click "Sign In" | Login fails, no SQL injection vulnerability |
| L-061 | XSS attempt in email | Enter `<script>alert(1)</script>@example.com` as email | Input sanitized/escaped, no script execution |
| L-062 | Brute force protection (if implemented) | Attempt login with wrong password 5+ times in quick succession | Account locked or rate limited after threshold |
| L-063 | Session cookie security (HttpOnly) | Login, inspect browser cookies | Session cookie has HttpOnly flag |
| L-064 | Session cookie security (Secure) | Login over HTTPS, inspect cookies | Session cookie has Secure flag |
| L-065 | CSRF token validation (if implemented) | Submit login form without CSRF token | Request rejected |
| L-066 | Password hashing in DB | Check DB after user registration | Password is hashed, not stored in plain text |

### Redirect/Callback Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| L-070 | Redirect after login with callbackUrl | Navigate to `/account/orders` (protected), redirect to `/login`, login | Redirect back to `/account/orders` after successful login |
| L-071 | Default redirect after login | Navigate to `/login`, login with no callbackUrl | Redirect to `/account/dashboard` (default) |
| L-072 | Redirect with invalid callbackUrl | Add `?callbackUrl=/external-site` to login URL, login | Should redirect to safe default, ignore external URL |
| L-073 | Google OAuth redirect mismatch | Change AUTH_URL to different port, try Google Sign In | Error: "Configuration" or redirect_uri mismatch |

---

## Signup Page (`/register`)

### Form Validation Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-001 | Empty name submission | Leave name blank, fill other fields, click "Create Account" | Validation error: "Name is required" |
| S-002 | Empty email submission | Leave email blank, fill other fields, click "Create Account" | Validation error: "Email is required" |
| S-003 | Empty password submission | Leave password blank, fill other fields, click "Create Account" | Validation error: "Password is required" |
| S-004 | Empty confirm password | Fill name, email, password, leave confirm blank, click "Create Account" | Validation error: "Please confirm your password" |
| S-005 | Invalid email format | Enter "invalid-email" in email field | Validation error: "Invalid email address" |
| S-006 | Weak password (too short) | Enter password with <8 characters | Password strength meter shows "Weak" or validation error |
| S-007 | Weak password (no uppercase) | Enter password with only lowercase letters | Password strength meter shows "Weak" |
| S-008 | Weak password (no lowercase) | Enter password with only uppercase letters | Password strength meter shows "Weak" |
| S-009 | Weak password (no number) | Enter password with only letters | Password strength meter shows "Weak" |
| S-010 | Weak password (no special char) | Enter password with only letters and numbers | Password strength meter shows "Weak" |
| S-011 | Strong password | Enter password with uppercase, lowercase, number, special char, 8+ chars | Password strength meter shows "Strong" |
| S-012 | Passwords do not match | Enter different passwords in password and confirm fields | Validation error: "Passwords do not match" |
| S-013 | Terms checkbox unchecked | Fill all fields, leave terms checkbox unchecked, click "Create Account" | Validation error or button disabled: "You must agree to the terms" |
| S-014 | Very long name | Enter 100+ character name | Should accept or show max length error |
| S-015 | Name with special characters | Enter name with accents or special chars (e.g., "José María") | Should accept valid Unicode characters |

### Email/Password Registration Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-020 | Successful registration with valid data | Enter valid name, email, strong password, confirm, check terms, click "Create Account" | Account created, success message, redirect to `/account/dashboard` |
| S-021 | Registration with already registered email | Enter email that already exists in DB | Error: "Email already registered" |
| S-022 | Registration with case-variant of existing email | Enter existing email with different case (e.g., User@Example.com vs user@example.com) | Error: "Email already registered" (case-insensitive check) |
| S-023 | Registration with trailing/leading spaces in email | Enter " user@example.com " with spaces | Should trim and check if email exists |
| S-024 | Password hashing verification | Register new user, check DB | Password is hashed, not stored in plain text |
| S-025 | User role default | Register new user, check DB | User role defaults to "CUSTOMER" |
| S-026 | isMember default | Register new user, check DB | isMember defaults to false |
| S-027 | emailVerified default | Register new user, check DB | emailVerified is null (not verified) |

### Google OAuth Registration Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-030 | Google Sign In with new account | Click "Continue with Google", authorize with new Google account not in DB | User created in DB with Google profile data, redirect to `/account/dashboard` |
| S-031 | Google Sign In links to existing email account | Register with email/password first, then Google Sign In with same email | Accounts should link (if `allowDangerousEmailAccountLinking: true` is set) |
| S-032 | Google Sign In with name from Google profile | Authorize with Google account that has name | User name in DB matches Google profile name |
| S-033 | Google Sign In with email from Google profile | Authorize with Google account | User email in DB matches Google profile email |
| S-034 | Google Sign In with image from Google profile | Authorize with Google account that has profile photo | User image in DB stores Google profile photo URL |
| S-035 | Google Sign In without name in profile | Authorize with Google account that has no name set | User name should be derived from email or set to null |
| S-036 | Google Sign In with Google Workspace account | Authorize with Google Workspace (e.g., @completehomesollution.com.au) | Should work if domain is allowed in Google Cloud Console |

### Password Strength Meter Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-040 | Empty password | Clear password field | Strength meter shows "Very Weak" or empty |
| S-041 | 1-5 characters | Enter 5 character password | Strength meter shows "Very Weak" |
| S-042 | 6-7 characters | Enter 7 character password | Strength meter shows "Weak" |
| S-043 | 8+ characters, only lowercase | Enter 8 lowercase letters | Strength meter shows "Weak" |
| S-044 | 8+ characters, lowercase + uppercase | Enter 8 mixed case letters | Strength meter shows "Medium" |
| S-045 | 8+ characters, mixed case + number | Enter password with letters and numbers | Strength meter shows "Medium" or "Strong" |
| S-046 | 8+ characters, mixed case + number + special | Enter password with all complexity requirements | Strength meter shows "Strong" |
| S-047 | Strength meter color coding | Enter passwords of varying strength | Color changes (red → yellow → green) |
| S-048 | Real-time strength update | Type password character by character | Strength meter updates in real-time |

### Error Handling Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-050 | Network error during registration | Disconnect network, fill form, click "Create Account" | Error: "Something went wrong" or network error message |
| S-051 | Server error (500) during registration | (Mock) Server returns 500 on registration | Error: "Something went wrong" |
| S-052 | Database connection error | (Mock) DB unavailable during registration | Error: "Something went wrong" or database error message |
| S-053 | Duplicate key error (email) | Try to register with email that already exists | Error: "Email already registered" |
| S-054 | Prisma schema mismatch (missing passwordHash) | Remove passwordHash from User schema, try registration | Error: "Something went wrong" (DB constraint error) |
| S-055 | Google OAuth callback error | (Mock) Google returns error in callback | Error message displayed based on error code |

### UI/UX Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-060 | Password show/hide toggle | Click eye icon in password field | Password toggles between visible and hidden |
| S-061 | Confirm password show/hide toggle | Click eye icon in confirm password field | Confirm password toggles between visible and hidden |
| S-062 | Terms checkbox interaction | Click terms checkbox | Checkbox toggles checked/unchecked state |
| S-063 | "Already have an account?" link | Click "Sign in" link | Redirect to `/login` |
| S-064 | Google button hover state | Hover over "Continue with Google" button | Visual hover effect |
| S-065 | Submit button loading state | Click "Create Account" with valid data | Button shows loading spinner or disabled state |
| S-066 | Form reset on error | Submit with existing email, then try new email | Form submits correctly without page reload |
| S-067 | Success animation | Successful registration | Success message/animation displayed |
| S-068 | Responsive design — mobile | View signup page on mobile viewport | Layout adapts (stacked, full width) |
| S-069 | Responsive design — tablet | View signup page on tablet viewport | Layout adapts appropriately |
| S-070 | Keyboard navigation (Tab) | Use Tab to navigate form fields | Focus moves logically through form |
| S-071 | Enter key to submit | Enter all fields, press Enter | Form submits (same as clicking "Create Account") |
| S-072 | Terms link opens in new tab | Click "Terms and Conditions" link | Opens in new tab/window |

### Security Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-080 | SQL injection in email | Enter `' OR '1'='1` as email | Registration fails, no SQL injection |
| S-081 | XSS in name field | Enter `<script>alert(1)</script>` as name | Input sanitized/escaped, no script execution |
| S-082 | XSS in email field | Enter `<script>alert(1)</script>@example.com` as email | Input sanitized/escaped, no script execution |
| S-083 | Password strength enforcement | Try to submit with weak password | Should be rejected or show warning |
| S-084 | Email verification (if implemented) | Register, check DB | emailVerified should be null until verified |
| S-085 | Rate limiting on registration | Attempt registration with same email multiple times quickly | Rate limit after threshold |
| S-086 | CSRF token validation (if implemented) | Submit form without CSRF token | Request rejected |

### Redirect/Callback Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| S-090 | Redirect after registration | Register successfully | Redirect to `/account/dashboard` |
| S-091 | Google OAuth redirect after registration | Register via Google Sign In | Redirect to `/account/dashboard` |
| S-092 | Redirect with callbackUrl (if supported) | Navigate to `/register?callbackUrl=/account/orders`, register | Redirect to `/account/orders` after registration |
| S-093 | Login link preserves context | Click "Sign in" from registration page | Redirect to `/login` with appropriate context |

---

## Cross-Page Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| X-001 | Register then login | Register new account, then login with same credentials | Login successful |
| X-002 | Register via Google, then login via email/password | Register via Google, then try email/password login | Should fail (no password set for OAuth user) |
| X-003 | Register via email/password, then login via Google | Register via email/password, then login via Google with same email | Should link accounts if `allowDangerousEmailAccountLinking: true` |
| X-004 | Logout then login | Login, logout, then login again | Both logins successful |
| X-005 | Session persists across pages | Login, navigate to `/products`, `/cart`, `/account/orders` | Session remains valid, navbar shows user avatar |
| X-006 | Protected route without login | Navigate to `/account/dashboard` without logging in | Redirect to `/login` |
| X-007 | Protected route with login | Login, navigate to `/account/dashboard` | Page loads successfully |
| X-008 | Multiple browser tabs login | Login in one tab, open `/account/dashboard` in another tab | Session shared, page loads |
| X-009 | Logout clears session | Login, logout, navigate to `/account/dashboard` | Redirect to `/login` |
| X-010 | Navbar user dropdown | Click user avatar in navbar after login | Dropdown shows with account links and sign out |

---

## Environment Configuration Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| E-001 | Missing AUTH_SECRET | Remove AUTH_SECRET from .env.local, restart dev server | Google OAuth shows "Configuration" error |
| E-002 | Missing NEXTAUTH_URL | Remove NEXTAUTH_URL from .env.local, restart dev server | May cause OAuth callback issues |
| E-003 | Missing AUTH_GOOGLE_ID | Remove AUTH_GOOGLE_ID from .env.local | Google button shows "not configured" error |
| E-004 | Missing AUTH_GOOGLE_SECRET | Remove AUTH_GOOGLE_SECRET from .env.local | Google button shows "not configured" error |
| E-005 | Invalid Google credentials | Set AUTH_GOOGLE_ID to invalid value | Google OAuth fails with "invalid_client" error |
| E-006 | Google redirect URI mismatch | Set wrong redirect URI in Google Cloud Console | OAuth callback fails with "redirect_uri_mismatch" |
| E-007 | DATABASE_URL missing | Remove DATABASE_URL from .env.local | Registration/login fails with database error |

---

## Browser Compatibility Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| B-001 | Chrome login/register | Test in Chrome browser | All functionality works |
| B-002 | Firefox login/register | Test in Firefox browser | All functionality works |
| B-003 | Safari login/register | Test in Safari browser | All functionality works |
| B-004 | Edge login/register | Test in Edge browser | All functionality works |
| B-005 | Mobile Safari (iOS) | Test on iOS Safari | All functionality works |
| B-006 | Mobile Chrome (Android) | Test on Android Chrome | All functionality works |

---

## Performance Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| P-001 | Login page load time | Measure time to load `/login` | < 2 seconds |
| P-002 | Signup page load time | Measure time to load `/register` | < 2 seconds |
| P-003 | Login API response time | Measure time for login API call | < 1 second |
| P-004 | Registration API response time | Measure time for registration API call | < 1 second |
| P-005 | Google OAuth callback time | Measure time from Google redirect to page load | < 2 seconds |

---

## Accessibility Tests

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| A-001 | Screen reader compatibility | Navigate login form with screen reader | All fields announced correctly |
| A-002 | Keyboard accessibility | Navigate form using only keyboard | All fields accessible via Tab |
| A-003 | ARIA labels on form fields | Inspect form fields | Proper aria-labels present |
| A-004 | Focus indicators | Tab through form | Visible focus indicators on all interactive elements |
| A-005 | Color contrast | Check color contrast ratios | Meets WCAG AA standards |
| A-006 | Error message announcements | Submit invalid form, check screen reader | Error messages announced |

---

## Notes

- All test cases assume the application is running in development mode at `http://localhost:3000`
- Some test cases marked with "(Mock)" require mocking server responses or database states
- Security tests should be run in a staging environment, not production
- Performance benchmarks may vary based on hardware and network conditions
