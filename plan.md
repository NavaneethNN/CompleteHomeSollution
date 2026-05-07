FurniShop AU — Project PlanAustralian furniture ecommerce platform built with Next.js 15Developed by: Navneeth NN | AI-assisted: Claude Sonnet + Opus1. Project OverviewFieldDetailProjectFull-stack furniture ecommerce for Australian marketDeveloper locationIndiaTarget usersAustraliaDev approachClaude Sonnet (coding) + Claude Opus (architecture decisions)Billing currencyUSD (services) · AUD (Stripe customer payments)Payment to developerINR via Stripe India (invite-only) or Paddle2. Tech Stack (Final, Locked)FrontendToolPurposeNext.js 15 (App Router)Framework — RSC, SSG, ISR, Server ActionsTypeScriptType safety across entire codebaseTailwind CSSUtility-first stylingshadcn/uiAccessible, unstyled component primitivesZustandClient-side cart + UI stateReact Query (TanStack)Server state, caching, background refetchReact Hook Form + ZodForm handling + validationnext/imageResponsive images, AVIF/WebP, R2 custom loaderBackendToolPurposeNext.js API RoutesREST endpoints + Server ActionsNextAuth.js v5Auth — Google OAuth + Email OTPStripeAUD payment processing, webhooksZodServer-side input validationDatabase & CacheToolPurposeNeon PostgresServerless Postgres — free 10 GBPrisma ORMType-safe queries, schema migrationsUpstash RedisSession cache, rate limiting, cart persistenceMedia & SearchToolPurposeCloudflare R2Product image storage — S3 compatible, zero egress fees, Sydney CDNnext/image + R2 loaderOn-the-fly resize, format conversionAlgolia FreeInstant product search, faceted filters (10k records free)CommunicationToolPurposeBrevoTransactional email — order confirm, shipping, OTP (9k/mo free)TwilioSMS OTP + order alert SMS to Australian numbersTwilio WhatsAppWhatsApp order updates + promotional messagesAI FeaturesToolPurposeVercel AI SDK + OpenAISmart product recommendation enginepgvector (Neon)Product embedding storage for similarity searchShippingToolPurposeShippit API (or Australia Post API)Automatic shipment rate calculation for AU addressesSecurityToolPurposeNextAuth.jsRBAC (role-based access: admin / member / customer / guest)Prisma parameterized queriesSQL injection prevention (automatic)Upstash RedisAPI rate limitingnext-safe-actionType-safe server actions with auth checksSSL/TLSVercel provides HTTPS automaticallyNeon automated backupsDaily point-in-time recoveryMFA via TOTPAdmin panel — Google Authenticator supportDevOps & HostingToolPurposeVercelDeployment, edge CDN, CI/CD previewsGitHub + GitHub ActionsVersion control, lint, type-check, test CINamecheap / CloudflareDomain (~$15/yr) + DNS + DDoS protectionSentry FreeError monitoring, performance tracingWise cardPaying USD-billed services from India at low forex3. Folder Structurefurnishop-au/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── verify/
│   ├── (shop)/
│   │   ├── page.tsx                  # Homepage
│   │   ├── products/
│   │   │   ├── page.tsx              # Product listing
│   │   │   └── [slug]/page.tsx       # Product detail
│   │   ├── categories/[slug]/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   ├── order-confirmation/page.tsx
│   │   └── search/page.tsx
│   ├── (account)/
│   │   ├── dashboard/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── membership/page.tsx       # Membership dashboard
│   │   └── profile/page.tsx
│   ├── (admin)/
│   │   ├── dashboard/page.tsx
│   │   ├── products/page.tsx
│   │   ├── membership/page.tsx       # Admin membership management
│   │   ├── orders/page.tsx
│   │   ├── customers/page.tsx
│   │   └── analytics/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── products/route.ts
│       ├── orders/route.ts
│       ├── upload/route.ts           # R2 presigned URL
│       ├── webhooks/stripe/route.ts
│       ├── webhooks/shippit/route.ts
│       └── recommendations/route.ts
├── components/
│   ├── ui/                           # shadcn primitives
│   ├── shop/                         # product cards, filters, cart
│   ├── checkout/                     # checkout steps
│   ├── admin/                        # admin panel components
│   └── shared/                       # navbar, footer, seo
├── lib/
│   ├── db.ts                         # Prisma client
│   ├── redis.ts                      # Upstash client
│   ├── r2.ts                         # Cloudflare R2 client
│   ├── algolia.ts                    # Algolia client
│   ├── stripe.ts                     # Stripe client
│   ├── brevo.ts                      # Brevo email client
│   ├── twilio.ts                     # Twilio SMS/WhatsApp
│   ├── shippit.ts                    # Shipping API
│   ├── ai.ts                         # Vercel AI SDK setup
│   └── validations/                  # Zod schemas
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── store/
│   ├── cart.ts                       # Zustand cart store
│   └── ui.ts                         # Zustand UI store
├── hooks/                            # Custom React hooks
├── types/                            # Global TypeScript types
└── public/                           # Static assets (no product images here)
4. Database Schema (Prisma)Code snippetmodel User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  phone         String?
  role          Role      @default(CUSTOMER)
  isMember      Boolean   @default(false)
  memberSince   DateTime?
  mfaEnabled    Boolean   @default(false)
  mfaSecret     String?
  createdAt     DateTime  @default(now())
  orders        Order[]
  reviews       Review[]
  addresses     Address[]
  cart          CartItem[]
}

model Product {
  id            String    @id @default(cuid())
  name          String
  slug          String    @unique
  description   String
  price         Float
  comparePrice  Float?
  memberPrice   Float?    // Added member discounted price
  stock         Int       @default(0)
  sku           String    @unique
  images        String[]  // R2 URLs
  categoryId    String
  category      Category  @relation(fields: [categoryId], references: [id])
  embedding     Unsupported("vector(1536)")?  // AI recommendations
  reviews       Review[]
  orderItems    OrderItem[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Category {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  image     String?
  products  Product[]
}

model Order {
  id              String      @id @default(cuid())
  userId          String?     // null = guest checkout
  user            User?       @relation(fields: [userId], references: [id])
  guestEmail      String?
  guestPhone      String?
  status          OrderStatus @default(PENDING)
  items           OrderItem[]
  address         Address     @relation(fields: [addressId], references: [id])
  addressId       String
  subtotal        Float
  shippingCost    Float
  tax             Float
  total           Float
  stripePaymentId String?
  trackingNumber  String?
  carrier         String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model OrderItem {
  id          String  @id @default(cuid())
  orderId     String
  order       Order   @relation(fields: [orderId], references: [id])
  productId   String
  product     Product @relation(fields: [productId], references: [id])
  quantity    Int
  unitPrice   Float
}

model Address {
  id        String  @id @default(cuid())
  userId    String?
  user      User?   @relation(fields: [userId], references: [id])
  line1     String
  line2     String?
  suburb    String
  state     String
  postcode  String
  country   String  @default("AU")
  orders    Order[]
}

model Review {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  rating    Int
  comment   String?
  createdAt DateTime @default(now())
}

model CartItem {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  productId String
  quantity  Int
}

enum Role {
  ADMIN
  MEMBER
  CUSTOMER
}

enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}
5. Environment VariablesCode snippet# Database
DATABASE_URL=                        # Neon Postgres connection string

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=                       # https://your-bucket.r2.dev or custom domain

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Algolia
NEXT_PUBLIC_ALGOLIA_APP_ID=
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=
ALGOLIA_ADMIN_KEY=

# Brevo
BREVO_API_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_NUMBER=

# Shippit
SHIPPIT_API_KEY=

# OpenAI (for AI recommendations)
OPENAI_API_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
6. Core Features — Detailed Breakdown6.1 Auth SystemEmail OTP login (Brevo sends OTP → Twilio SMS fallback)Google OAuth social loginGuest checkout (no account required, email stored on order)RBAC: ADMIN can access /admin/, MEMBER can access /account/membership, CUSTOMER can access /account/MFA via TOTP for admin accounts (Google Authenticator)Session stored in Upstash Redis via NextAuth adapter6.2 Product SystemProduct listing with SSG + ISR (revalidate on stock/price change)Category pages — SSG with dynamic paramsProduct detail — dual pricing display: Regular Price and Member Discounted Price, image gallery (R2), specs, stock badge, add to cartAlgolia search with filters: category, price range, material, room typeUser reviews and star ratings (authenticated users only)Stock alerts — email/SMS when out-of-stock item restocks6.3 Cart & CheckoutCart persisted in Zustand (localStorage sync) + Upstash Redis (logged-in users)Member-specific pricing automatically applied at checkout for active membersGuest checkout: collect name, email, phone, shipping addressAutomatic shipping cost calculation via Shippit API (postcode-based AU rates)Stripe Checkout (hosted) or Stripe Elements (embedded) for AUD paymentOrder confirmation page + Brevo email + Twilio SMS after successful paymentWhatsApp order confirmation via Twilio WhatsApp Business API6.4 AI Recommendation SystemProduct embeddings generated via OpenAI text-embedding-3-smallStored in Neon Postgres using pgvector extension"Similar products" on product detail page (cosine similarity search)"Frequently bought together" on cart page"Recommended for you" on homepage (based on order history)6.5 Automatic Shipment CalculationShippit API integration — calculates real-time rates from Sydney/Melbourne warehousesSupports: standard, express, same-day (where available)Postcode validation for Australian addressesReturns carrier + estimated delivery date + cost → shown at checkout6.6 Communication AutomationEventEmail (Brevo)SMS (Twilio)WhatsApp (TwilioOTP loginYesFallbackNoOrder placedYesYesYesOrder shippedYesYesYesDelivery confirmedYesNoYesStock alertYesNoNoPromotionalYesNoYes6.7 Admin Panel (/admin)Protected by ADMIN role + MFADashboard: revenue, orders today, top products, low stock alertsMembership Management: control membership offers, add or modify member pricingProduct CRUD: create/edit products, upload images to R2, set categoriesOrder management: view, update status, trigger shipmentCustomer list and order historyAnalytics: revenue chart, traffic, conversion rate (via Vercel Analytics)6.8 SecurityAll DB queries via Prisma (parameterized, no raw SQL injection risk)Upstash rate limiting on API routes (100 req/min per IP)RBAC enforced server-side in every API route and Server ActionSSL/TLS: Vercel auto-provisions certificatesMFA enforced for /admin routesNeon automated backups: daily snapshots, 7-day retention on free tierInput sanitization via Zod on all API inputsCSRF protection via NextAuth built-in tokensContent Security Policy headers via next.config.js7. Development Path — Phase by PhaseFollow this order exactly. Each phase builds on the previous.At the start of every new Claude session, paste this plan.md as context.Phase 1 — Project Setup & InfrastructureGoal: Working Next.js app connected to all services1.1  Init Next.js 15 with TypeScript, Tailwind, ESLint
1.2  Install and configure shadcn/ui
1.3  Set up Neon Postgres + Prisma schema + first migration
1.4  Set up Upstash Redis client (lib/redis.ts)
1.5  Set up Cloudflare R2 client (lib/r2.ts)
1.6  Set up Algolia client (lib/algolia.ts)
1.7  Configure environment variables (.env.local)
1.8  Set up Sentry error monitoring
1.9  Set up GitHub repo + GitHub Actions (lint + type-check on PR)
1.10 Deploy empty app to Vercel — confirm all env vars work
Done when: npm run build passes, Vercel deployment is live, DB connectedPhase 2 — Auth SystemGoal: Users can register, log in, log out2.1  Install NextAuth.js v5, configure providers (Google + Email)
2.2  Create Prisma User model + NextAuth adapter
2.3  Build login page UI (/login) — email OTP flow
2.4  Build register page UI (/register)
2.5  Build OTP verification page (/verify)
2.6  Add Google OAuth button
2.7  Integrate Brevo for OTP emails
2.8  Integrate Twilio for OTP SMS fallback
2.9  Implement session middleware — protect /account/* and /admin/*
2.10 Set up RBAC middleware (check user.role)
2.11 Build admin MFA setup (TOTP — speakeasy library)
2.12 Test: register → login → access account → logout
Done when: Full auth flow works, RBAC blocks unauthorized accessPhase 3 — Product CatalogGoal: Products are in DB and render on the site3.1  Seed database with sample categories (Living Room, Bedroom, Dining, Office)
3.2  Seed 20 sample products with R2 image uploads
3.3  Build Category model and API
3.4  Build product listing page (SSG + ISR) with grid layout
3.5  Build product detail page ([slug]) — image gallery, specs, stock badge
3.6  Build category filter page (/categories/[slug])
3.7  Implement Algolia indexing (sync products to Algolia on create/update)
3.8  Build search page with Algolia InstantSearch
3.9  Add faceted filters: category, price range, material, room type
3.10 Implement review + rating system (POST /api/reviews)
3.11 Add stock alert subscription (email when item restocks)
3.12 Test: browse → filter → search → view product → leave review
Done when: Full product catalog browsable, search working, reviews workingPhase 4 — Cart & CheckoutGoal: Users can buy products end-to-end4.1  Build Zustand cart store (add/remove/update quantity)
4.2  Persist cart to Upstash Redis for logged-in users
4.3  Build cart page UI (/cart)
4.4  Build checkout page — shipping address form (AU postcode validation)
4.5  Integrate Shippit API — fetch real-time shipping rates at checkout
4.6  Display shipping options with carrier + ETA + cost
4.7  Integrate Stripe — create PaymentIntent or Checkout Session
4.8  Build order confirmation page (/order-confirmation/[orderId])
4.9  Create Order in DB after Stripe webhook confirms payment
4.10 Guest checkout flow (no login required)
4.11 Send order confirmation: Brevo email + Twilio SMS + WhatsApp
4.12 Test: add to cart → guest checkout → pay → confirmation → emails received
Done when: End-to-end purchase flow works for both guest and logged-in usersPhase 5 — Account DashboardGoal: Logged-in users can manage their account5.1  Build account dashboard page (/account/dashboard)
5.2  Build order history page (/account/orders)
5.3  Build order detail page (/account/orders/[id]) with tracking info
5.4  Build profile edit page (/account/profile)
5.5  Build saved addresses management
5.6  Implement stock alert preferences
5.7  Test: login → view orders → edit profile → manage addresses
Done when: Customer self-service works completelyPhase 5.5 — Membership ManagementGoal: Users can become members to access special pricing and view member benefits5.5.1 Build membership registration/login flow
5.5.2 Build membership display dashboard (/account/membership)
5.5.3 Apply discount logic in cart and product pages for active members
5.5.4 Test: login as member → verify dual price displays correctly on the store front
Done when: Membership panel works and member pricing reflects in cartPhase 6 — Admin PanelGoal: Admin can manage the entire store6.1  Build admin layout with sidebar (/admin)
6.2  Admin auth guard: role === ADMIN + MFA verified
6.3  Build admin dashboard (revenue, order count, low stock widgets)
6.4  Build product management: list, create, edit, delete
6.5  Build Membership Offer control module in admin dashboard
6.6  Build R2 image upload UI (presigned URL → direct browser upload)
6.7  Build order management: list, filter by status, update status
6.8  Build shipment management: enter tracking number → trigger SMS to customer
6.9  Build customer list page
6.10 Build analytics page (Vercel Analytics embed)
6.11 Test: admin login + MFA → create product → process order → update status
Done when: Admin can manage products, members, and orders without touching the DBPhase 7 — AI Recommendation SystemGoal: Smart product recommendations on the site7.1  Enable pgvector extension on Neon
7.2  Add embedding column to Product model in Prisma
7.3  Write script to generate embeddings for all products via OpenAI
7.4  Build /api/recommendations endpoint (cosine similarity query)
7.5  Add "Similar products" section to product detail page
7.6  Add "Frequently bought together" section to cart page
7.7  Add "Recommended for you" section to homepage (based on order history)
7.8  Test: view product → see relevant recommendations, not random ones
Done when: Recommendations feel relevant and load fastPhase 8 — Polish, SEO & PerformanceGoal: Production-ready, fast, SEO-optimized8.1  Add generateMetadata() to all pages (dynamic OG tags)
8.2  Add JSON-LD structured data to product pages (Google Shopping rich results)
8.3  Install next-sitemap — auto-generate sitemap.xml
8.4  Add robots.txt
8.5  Audit Core Web Vitals (LCP, CLS, FID) — fix any issues
8.6  Implement ISR revalidation strategy (product pages on stock change)
8.7  Add loading.tsx skeletons for all major pages
8.8  Add error.tsx boundaries for all route groups
8.9  Configure Content Security Policy headers in next.config.js
8.10 Run Lighthouse audit — target 95+ on all scores
8.11 Final security audit: check all routes have auth guards, rate limiting applied
8.12 Set up Vercel Analytics + Speed Insights
Done when: Lighthouse 95+, sitemap indexed, all pages have OG metadataPhase 9 — Testing & LaunchGoal: Stable, tested, live9.1  Write Prisma unit tests for DB operations
9.2  Write API route integration tests (Vitest)
9.3  E2E tests for critical paths: register → buy → confirmation (Playwright)
9.4  Load test checkout flow (k6)
9.5  Test Stripe webhooks end-to-end (stripe CLI)
9.6  Test all communication flows (email, SMS, WhatsApp)
9.7  Set up production environment variables on Vercel
9.8  Point custom domain (Namecheap → Cloudflare → Vercel)
9.9  Enable Cloudflare proxy (orange cloud) for DDoS protection
9.10 Final QA pass on mobile (iPhone SE and Galaxy S22 viewport sizes)
9.11 Launch
Done when: Live on custom domain, all tests passing, monitoring active8. Page Inventory (Complete List)Public pages (no login required)RouteTypeNotes/SSGHomepage — hero, featured products, categories/productsSSG+ISRProduct listing grid with filters/products/[slug]SSG+ISRProduct detail, dual pricing, reviews, recommendations/categories/[slug]SSG+ISRCategory-filtered product listing/searchCSRAlgolia InstantSearch/cartCSRCart page (Zustand state)/checkoutCSRMulti-step: address → shipping → payment/order-confirmation/[id]SSRPost-purchase confirmationAuth pagesRouteTypeNotes/loginCSREmail OTP + Google OAuth/registerCSRRegistration form/verifyCSROTP code entryAccount pages (CUSTOMER role)RouteTypeNotes/account/dashboardSSRWelcome, recent orders/account/ordersSSROrder history list/account/orders/[id]SSROrder detail + tracking/account/membershipSSRMembership details/account/profileCSREdit name, phone, email/account/addressesCSRManage delivery addressesAdmin pages (ADMIN role + MFA)RouteTypeNotes/adminSSRDashboard — KPIs, charts/admin/productsSSRProduct list + search/admin/products/newCSRCreate product form/admin/products/[id]CSREdit product/admin/membershipSSRManage membership features and pricing/admin/ordersSSROrder management table/admin/orders/[id]SSROrder detail + status update/admin/customersSSRCustomer list/admin/analyticsCSRRevenue + traffic charts9. API Routes InventoryPOST   /api/auth/[...nextauth]       NextAuth handler
GET    /api/products                 List products (with filters)
POST   /api/products                 Create product (ADMIN)
GET    /api/products/[id]            Get single product
PUT    /api/products/[id]            Update product (ADMIN)
DELETE /api/products/[id]            Delete product (ADMIN)
POST   /api/upload                   Get R2 presigned upload URL (ADMIN)
GET    /api/categories               List categories
POST   /api/categories               Create category (ADMIN)
GET    /api/orders                   List orders (user's own or all for ADMIN)
POST   /api/orders                   Create order (guest or authenticated)
GET    /api/orders/[id]              Get order detail
PUT    /api/orders/[id]/status       Update order status (ADMIN)
POST   /api/reviews                  Submit review (authenticated)
GET    /api/reviews/[productId]      Get reviews for product
POST   /api/shipping/rates           Get Shippit rates for address + cart
POST   /api/recommendations          Get AI recommendations for product/user
POST   /api/stock-alerts             Subscribe to stock alert
POST   /api/webhooks/stripe          Stripe payment confirmed webhook
POST   /api/webhooks/shippit         Shippit tracking update webhook
