# Complete Home Sollution — Project Setup Guide

This guide will help you set up the Complete Home Sollution furniture e-commerce application on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 22.12 or newer within the 22.x line ([Download](https://nodejs.org/))
- **npm** or **pnpm** (npm comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- A code editor (VS Code recommended)

## 1. Clone the Repository

```bash
git clone https://github.com/NavaneethNN/CompleteHomeSollution.git
cd CompleteHomeSollution
```

## 2. Install Dependencies

```bash
npm ci
```

This will install all required packages including Next.js, Prisma, NextAuth, and other dependencies.

## 3. Environment Variables Setup

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the following required environment variables:

### Database Configuration

```env
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

Replace with your Neon PostgreSQL connection string.

### NextAuth Configuration

```env
AUTH_SECRET="your-random-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

To generate a random `AUTH_SECRET`, run:

```bash
openssl rand -base64 32
```

### Google OAuth Configuration

You need to set up Google OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/).

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add the following **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - (For production) `https://yourdomain.com/api/auth/callback/google`
7. Add the following **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - (For production) `https://yourdomain.com`
8. Copy the **Client ID** and **Client Secret**

Add to `.env.local`:

```env
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

### Google Maps API (for Address Autocomplete)

For the address autocomplete feature to work, you need a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Library**
4. Search for and enable **Places API** and **Maps JavaScript API**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **API Key**
7. (Optional) Restrict the API key to HTTP referrers for security:
   - Add `http://localhost:3000/*` for local development
   - Add your production domain for deployment

Add to `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

**Note:** This key is required for the address autocomplete feature to work. Without it, users will need to manually enter their address.

### Optional Services (for production)

The following services are optional for local development but required for production features:

```env
# Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Algolia (for search)
ALGOLIA_APP_ID="your-app-id"
ALGOLIA_SEARCH_API_KEY="your-search-api-key"
ALGOLIA_ADMIN_API_KEY="your-admin-api-key"

# Brevo (formerly Sendinblue) (for emails)
BREVO_API_KEY="your-api-key"

# Twilio (for SMS)
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+61..."

# Cloudflare R2 (for file storage)
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="your-bucket-name"

# Redis (for caching)
REDIS_URL="redis://localhost:6379"

# Ship123 (freight quotes and manual shipping labels)
SHIP_123_API_KEY="your-api-secret"
SHIP123_SENDER_NAME="Sender contact"
SHIP123_SENDER_LINE1="1 Example Street"
# SHIP123_SENDER_STREET may be used instead of SHIP123_SENDER_LINE1.
SHIP123_SENDER_SUBURB="Melbourne"
SHIP123_SENDER_STATE="VIC"
SHIP123_SENDER_POSTCODE="3000"
SHIP123_SENDER_PHONE="0400000000"
```

## 4. Database Setup

### Generate Prisma Client

```bash
npx prisma generate
```

### Apply Reviewed Migrations

```bash
npm run db:deploy
```

This applies the checked-in Prisma migrations to the configured database. Use a
test database for local development; do not use `prisma db push` for releases.

### (Optional) View Database with Prisma Studio

```bash
npx prisma studio
```

This opens a visual database explorer in your browser.

## 5. Run the Development Server

```bash
npm run dev
```

The application will be available at [https://localhost:3000](https://localhost:3000).
Include the `https://` prefix when opening it. `http://localhost:3000` connects
to the HTTPS-only port as plain HTTP and produces an empty-response browser
error. An IDE preview must also use HTTPS for this port.
The default command serves HTTPS and sets the local app, auth, and OnlinePay
return URLs to that origin. It creates an ignored, self-signed localhost
certificate when needed (OpenSSL is required). Accept the browser's local
certificate warning before starting a test checkout. Use `npm run dev:http`
only when testing features that do not need OnlinePay. Both local commands
use the in-process development rate limiter; `dev:tunnel` reads the configured
shared Redis credentials when testing a public staging-like origin.

### Test OnlinePay locally

For a normal sandbox payment, open `https://localhost:3000` and complete the
hosted checkout in the same browser. OnlinePay redirects the browser back to
the signed order page, which verifies the checkout with OnlinePay's API and
settles a successful payment. A public tunnel is not required. If the payment
page is closed before returning, revisit the pending order's signed return
link and use **Check again**; the local app cannot receive webhooks while
offline or hidden behind localhost. Do not treat the browser redirect alone as
proof of payment.

To test OnlinePay webhooks as well, expose local port 3000 with a Cloudflare
Quick Tunnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

The command prints a temporary HTTPS address. Anyone with that address can
reach the local app while the tunnel runs, so use only test payment credentials.
Set the following in `.env.local` to
the tunnel's HTTPS origin (for example, `https://your-tunnel.example`):

```env
AUTH_URL=https://your-tunnel.example
NEXTAUTH_URL=https://your-tunnel.example
NEXT_PUBLIC_APP_URL=https://your-tunnel.example
ONLINEPAY_RETURN_BASE_URL=https://your-tunnel.example
```

Start the app with `npm run dev:tunnel` and open the store through the tunnel
address. This script serves HTTP behind the tunnel and reads the URLs from
`.env.local` instead of forcing localhost. If you use Google sign-in, register
the tunnel's callback URL with Google too.
The tunnel must remain running while testing webhooks. Register
`https://your-tunnel.example/api/webhooks/onlinepay` as the test webhook URL
in the OnlinePay dashboard.

Do not use `https://localhost:3000` as the return URL while `dev:http` is
running: the browser redirect will fail to connect. Localhost is not reachable
by OnlinePay webhooks; the signed return page handles normal local test
payments instead.

### Ship123 shipping

For a plain-language explanation of checkout, labels, and the remaining account
setup, read [CHECKOUT_AND_SHIP123_GUIDE.md](CHECKOUT_AND_SHIP123_GUIDE.md).

Set `SHIP_123_API_KEY` in `.env`. Checkout sends the full Australian delivery
address and packaged dimensions to Ship123's freight-calculation API. Ship123
currently returns this account's quotes in USD; the server converts them to AUD
using the latest matching daily USD and AUD [ECB reference rates](https://data.ecb.europa.eu/help/api/data-examples).
If Ship123 or the FX source is unavailable, paid shipping checkout stops rather
than accepting an unverified amount. The signed quote binds the exact AUD cents,
delivery address, package set, and service for ten minutes.

This account lists named Australia Post services through Ship123; these are
allowed. The store does not call the Australia Post API directly. The generic
`AUTO_LOWEST_PRICE` service remains excluded so a named carrier and service
are recorded on each order. Physical checkout still requires a successful
Ship123 quote, including for free-shipping orders. Standalone membership
purchases are unaffected. Check the [Ship123 product-list API](https://ship123-api.readme.io/reference/listavailableproductusingpost)
if account services change.

Shipping labels are created manually from an administrator's order page after
payment. Add the sender address variables shown above first. The action stores
the Ship123 order number before looking up tracking and the label URL. If an
order-creation request times out, it blocks automatic retries; find the
`customerOrderNo` in Ship123 and attach its existing order number from the
admin page. No label is created automatically on payment.

## 6. Build for Production

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

## Project Structure

```
CompleteHomeSollution/
├── app/                      # Next.js App Router
│   ├── (account)/           # Account pages (dashboard, orders, profile, etc.)
│   ├── (admin)/             # Admin panel
│   ├── (auth)/              # Authentication pages (login, register)
│   ├── (shop)/              # Shop pages (products, cart, checkout)
│   ├── api/                 # API routes
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── shared/              # Shared components (navbar, footer, providers)
│   └── ui/                  # UI components (buttons, cards, etc.)
├── lib/                     # Utility libraries
│   ├── db.ts                # Prisma client
│   ├── password.ts          # Password hashing (Web Crypto API)
│   └── validations/         # Zod schemas
├── prisma/                  # Prisma ORM
│   ├── schema.prisma        # Database schema
│   └── prisma.config.ts     # Prisma 7 config
├── store/                   # Zustand state stores
├── hooks/                   # Custom React hooks
├── auth.ts                  # NextAuth configuration
├── middleware.ts            # Next.js middleware for route protection
└── public/                  # Static assets
```

## Key Features

- **Authentication**: Email/password login and Google OAuth via NextAuth v5
- **Database**: PostgreSQL with Prisma 7 ORM
- **Styling**: Tailwind CSS v4 with custom theme
- **State Management**: Zustand for cart and UI state
- **Type Safety**: TypeScript throughout
- **Route Protection**: Middleware-based auth for protected routes

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma db push` | Push schema changes to database |
| `npx prisma studio` | Open Prisma Studio (database GUI) |

## Authentication Flow

### Email/Password Login

1. User enters email and password on `/login`
2. Server action validates credentials
3. Password is verified using Web Crypto API (Edge-compatible)
4. Session created with JWT strategy
5. User redirected to `/account/dashboard`

### Google OAuth Login

1. User clicks "Continue with Google" on `/login` or `/register`
2. Redirected to Google consent screen
3. User authorizes the application
4. Google redirects back to `/api/auth/callback/google`
5. User is created/linked in database
6. Session created with JWT strategy
7. User redirected to `/account/dashboard`

## Troubleshooting

### Google OAuth "Configuration" Error

If you see a "Google sign-in is not configured yet" error:

1. Ensure `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set in `.env.local`
2. Ensure `AUTH_SECRET` is set in `.env.local`
3. Restart the development server after changing environment variables
4. Verify the redirect URI in Google Cloud Console matches: `http://localhost:3000/api/auth/callback/google`

### Google OAuth "redirect_uri_mismatch" Error

If you see a redirect URI mismatch:

1. Check that you're accessing the app at `http://localhost:3000` (not through a proxy)
2. Ensure the redirect URI in Google Cloud Console is exactly: `http://localhost:3000/api/auth/callback/google`
3. Verify `NEXTAUTH_URL=http://localhost:3000` in `.env.local`

### Google OAuth Not Working After Cloning

If Google OAuth fails after cloning the project:

1. **Check env vars are loaded:**
   - Look at the dev server terminal for: `[auth] Google OAuth config: { hasClientId: true, hasClientSecret: true, authUrl: 'http://localhost:3000' }`
   - If `hasClientId: false`, copy `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from the original `.env` file

2. **Verify Google Cloud Console configuration:**
   - Go to https://console.cloud.google.com/apis/credentials
   - Find the OAuth 2.0 Client ID: `758619436282-5cooe8q7mcp8voomo4ulfqdto1hfdfl8.apps.googleusercontent.com`
   - Under "Authorized redirect URIs", ensure `http://localhost:3000/api/auth/callback/google` is listed
   - If your colleague is on a different port (e.g., 3001), add that URI too: `http://localhost:3001/api/auth/callback/google`

3. **Check for network/firewall issues:**
   - Some corporate networks block Google OAuth
   - Try using a different network or mobile hotspot

4. **Restart the dev server** after updating env vars

### Database Connection Error

If you see database connection errors:

1. Verify `DATABASE_URL` is correct in `.env.local`
2. Ensure your Neon PostgreSQL database is running
3. Run `npx prisma db push` to ensure schema is synced

### Prisma Schema Mismatch

If you see errors about missing fields (e.g., `emailVerified`):

```bash
npx prisma db push
```

This will update your database schema to match the Prisma schema.

### Type Errors

If you see TypeScript errors:

```bash
npm run type-check
```

### Build Errors

If the build fails:

1. Delete the `.next` folder: `rm -rf .next`
2. Rebuild: `npm run build`

## Development Tips

- Use `npx prisma studio` to inspect your database during development
- Check the browser console for client-side errors
- Check the terminal for server-side errors
- The dev server supports hot reload — changes appear automatically
- Use `npm run type-check` to catch TypeScript errors before building

## Production Deployment

### Environment Variables for Production

When deploying to production, update the following environment variables:

```env
NEXTAUTH_URL="https://yourdomain.com"
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
AUTH_GOOGLE_ID="your-production-client-id"
AUTH_GOOGLE_SECRET="your-production-client-secret"
```

Also update the Google OAuth redirect URIs in Google Cloud Console to include your production domain.

### Recommended Deployment Platforms

- **Vercel** (recommended for Next.js)
- **Railway**
- **Render**
- **AWS Amplify**

## Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/NavaneethNN/CompleteHomeSollution/issues)
- Check the [testcase.md](./testcase.md) for test cases and expected behaviors

## License

This project is private. All rights reserved.
