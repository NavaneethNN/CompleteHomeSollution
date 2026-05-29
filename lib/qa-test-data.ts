export type Suite = "login" | "signup" | "profile" | "products" | "cart" | "wishlist" | "checkout" | "orders" | "membership" | "admin-products" | "admin-orders" | "admin-customers" | "admin-coupons" | "blog";
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
  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION & USER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  // ─── LOGIN: Form Validation ──────────────────────────────────────────────────
  { id: "L-001", suite: "login", category: "Form Validation", description: "Empty email submission", steps: "Leave email field blank, enter password, click \"Sign In\"", expected: "Email validation error displayed" },
  { id: "L-002", suite: "login", category: "Form Validation", description: "Empty password submission", steps: "Enter valid email, leave password blank, click \"Sign In\"", expected: "Password validation error displayed" },
  { id: "L-003", suite: "login", category: "Form Validation", description: "Invalid email format", steps: "Enter \"invalid-email\" in email field, enter password, click \"Sign In\"", expected: "Email format validation error" },
  { id: "L-004", suite: "login", category: "Form Validation", description: "Whitespace-only email", steps: "Enter \"   \" in email field, enter password, click \"Sign In\"", expected: "Email validation error for empty input" },
  { id: "L-005", suite: "login", category: "Form Validation", description: "Whitespace-only password", steps: "Enter valid email, enter \"   \" in password, click \"Sign In\"", expected: "Password validation error" },

  // ─── LOGIN: Authentication ───────────────────────────────────────────────────
  { id: "L-010", suite: "login", category: "Authentication", description: "Successful login with email/password", steps: "Enter registered email and correct password, click \"Sign In\"", expected: "Redirect to /account/dashboard" },
  { id: "L-011", suite: "login", category: "Authentication", description: "Login with unregistered email", steps: "Enter unregistered email, any password, click \"Sign In\"", expected: "Error: \"Invalid email or password\"" },
  { id: "L-012", suite: "login", category: "Authentication", description: "Login with wrong password", steps: "Enter registered email, incorrect password, click \"Sign In\"", expected: "Error: \"Invalid email or password\"" },
  { id: "L-013", suite: "login", category: "Authentication", description: "Google OAuth sign in", steps: "Click \"Continue with Google\", authorize with Google account", expected: "Redirect to /account/dashboard, user logged in" },
  { id: "L-014", suite: "login", category: "Authentication", description: "Password visibility toggle", steps: "Click eye icon in password field", expected: "Password toggles between visible and hidden" },
  { id: "L-015", suite: "login", category: "Authentication", description: "Redirect to signup page", steps: "Click \"Create account\" link", expected: "Redirect to /register" },

  // ─── SIGNUP: Form Validation ───────────────────────────────────────────────
  { id: "S-001", suite: "signup", category: "Form Validation", description: "Empty name field", steps: "Leave name blank, fill other fields, click \"Create Account\"", expected: "Name validation error" },
  { id: "S-002", suite: "signup", category: "Form Validation", description: "Empty email field", steps: "Leave email blank, fill other fields, click \"Create Account\"", expected: "Email validation error" },
  { id: "S-003", suite: "signup", category: "Form Validation", description: "Empty password field", steps: "Leave password blank, fill other fields, click \"Create Account\"", expected: "Password validation error" },
  { id: "S-004", suite: "signup", category: "Form Validation", description: "Password confirmation mismatch", steps: "Enter different passwords in password and confirm fields", expected: "Password mismatch error" },
  { id: "S-005", suite: "signup", category: "Form Validation", description: "Invalid email format", steps: "Enter \"invalid-email\" in email field", expected: "Email format validation error" },
  { id: "S-006", suite: "signup", category: "Form Validation", description: "Weak password validation", steps: "Enter short/simple password", expected: "Password strength warning" },
  { id: "S-007", suite: "signup", category: "Form Validation", description: "Terms not accepted", steps: "Fill all fields, leave terms unchecked, click \"Create Account\"", expected: "Terms acceptance required error" },

  // ─── SIGNUP: Registration ────────────────────────────────────────────────────
  { id: "S-010", suite: "signup", category: "Registration", description: "Successful registration", steps: "Enter valid name, email, strong password, confirm, check terms, click \"Create Account\"", expected: "Account created, redirect to /account/dashboard" },
  { id: "S-011", suite: "signup", category: "Registration", description: "Duplicate email registration", steps: "Enter email that already exists in DB", expected: "Error: \"Email already registered\"" },
  { id: "S-012", suite: "signup", category: "Registration", description: "Google OAuth registration", steps: "Click \"Continue with Google\", authorize with new account", expected: "User created, redirect to dashboard" },
  { id: "S-013", suite: "signup", category: "Registration", description: "Password strength meter", steps: "Type password in password field", expected: "Strength meter updates in real-time" },

  // ─── PROFILE: User Profile ───────────────────────────────────────────────────
  { id: "P-001", suite: "profile", category: "Profile Management", description: "View profile page", steps: "Login and navigate to /account/profile", expected: "Profile page loads with user data pre-filled" },
  { id: "P-002", suite: "profile", category: "Profile Management", description: "Update name", steps: "Change name field, click Save Changes", expected: "Name updated successfully, success toast shown" },
  { id: "P-003", suite: "profile", category: "Profile Management", description: "Update phone number", steps: "Add/change phone, click Save", expected: "Phone saved successfully" },
  { id: "P-004", suite: "profile", category: "Profile Management", description: "Update profile image", steps: "Enter image URL, click Save", expected: "Image preview shown, saved to database" },
  { id: "P-005", suite: "profile", category: "Profile Management", description: "Unauthenticated access blocked", steps: "Navigate to /account/profile while not logged in", expected: "Redirect to /login page" },

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCTS & CATALOG
  // ═══════════════════════════════════════════════════════════════════════════════

  // ─── PRODUCTS: Browse & Search ───────────────────────────────────────────────
  { id: "PR-001", suite: "products", category: "Product Browsing", description: "View product list", steps: "Navigate to /shop or homepage", expected: "Products displayed with images, names, prices" },
  { id: "PR-002", suite: "products", category: "Product Browsing", description: "Search products", steps: "Enter search term in search box, press Enter", expected: "Search results displayed matching query" },
  { id: "PR-003", suite: "products", category: "Product Browsing", description: "Filter by category", steps: "Click on category link in navigation", expected: "Products filtered by selected category" },
  { id: "PR-004", suite: "products", category: "Product Browsing", description: "View product details", steps: "Click on a product card", expected: "Product detail page with full info displayed" },
  { id: "PR-005", suite: "products", category: "Product Browsing", description: "View product variants", steps: "Open product with variants, select different options", expected: "Price/stock updates based on variant selection" },

  // ─── PRODUCTS: Reviews ───────────────────────────────────────────────────────
  { id: "PR-010", suite: "products", category: "Product Reviews", description: "View product reviews", steps: "Scroll to reviews section on product page", expected: "Existing reviews displayed with ratings" },
  { id: "PR-011", suite: "products", category: "Product Reviews", description: "Submit review (authenticated)", steps: "Login, write review, add rating, click Submit", expected: "Review submitted and displayed" },
  { id: "PR-012", suite: "products", category: "Product Reviews", description: "Submit review (unauthenticated)", steps: "Try to submit review without logging in", expected: "Login prompt or error shown" },
  { id: "PR-013", suite: "products", category: "Product Reviews", description: "Review with images", steps: "Submit review with uploaded images", expected: "Images displayed in review" },

  // ─── PRODUCTS: Wishlist ──────────────────────────────────────────────────────
  { id: "W-001", suite: "wishlist", category: "Wishlist", description: "Add to wishlist", steps: "Click heart icon on product", expected: "Product added to wishlist, heart filled" },
  { id: "W-002", suite: "wishlist", category: "Wishlist", description: "Remove from wishlist", steps: "Click filled heart icon on product", expected: "Product removed from wishlist" },
  { id: "W-003", suite: "wishlist", category: "Wishlist", description: "View wishlist", steps: "Navigate to /shop/wishlist", expected: "Wishlist items displayed" },
  { id: "W-004", suite: "wishlist", category: "Wishlist", description: "Add to cart from wishlist", steps: "Click \"Add to Cart\" on wishlist item", expected: "Item added to cart" },
  { id: "W-005", suite: "wishlist", category: "Wishlist", description: "Wishlist persists after logout", steps: "Add to wishlist, logout, login again", expected: "Wishlist items still present" },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CART & CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════════════

  // ─── CART: Cart Management ───────────────────────────────────────────────────
  { id: "C-001", suite: "cart", category: "Cart", description: "Add product to cart", steps: "Click \"Add to Cart\" on product page", expected: "Product added, cart count updated" },
  { id: "C-002", suite: "cart", category: "Cart", description: "Add variant to cart", steps: "Select variant options, click \"Add to Cart\"", expected: "Specific variant added to cart" },
  { id: "C-003", suite: "cart", category: "Cart", description: "Update quantity", steps: "Change quantity in cart", expected: "Quantity updated, totals recalculated" },
  { id: "C-004", suite: "cart", category: "Cart", description: "Remove from cart", steps: "Click remove button on cart item", expected: "Item removed from cart" },
  { id: "C-005", suite: "cart", category: "Cart", description: "View cart", steps: "Navigate to /shop/cart", expected: "Cart items displayed with prices" },
  { id: "C-006", suite: "cart", category: "Cart", description: "Member pricing in cart", steps: "Login as member, view cart", expected: "Member prices shown for applicable items" },
  { id: "C-007", suite: "cart", category: "Cart", description: "Cart persists after refresh", steps: "Add items, refresh page", expected: "Cart items still present" },
  { id: "C-008", suite: "cart", category: "Cart", description: "Empty cart state", steps: "Remove all items from cart", expected: "Empty cart message with continue shopping link" },
  { id: "C-009", suite: "cart", category: "Cart", description: "Proceed to checkout", steps: "Click \"Proceed to Checkout\"", expected: "Redirect to checkout page" },

  // ─── CHECKOUT: Checkout Flow ───────────────────────────────────────────────────
  { id: "CH-001", suite: "checkout", category: "Checkout", description: "View checkout page", steps: "Navigate to checkout with items in cart", expected: "Checkout form with order summary displayed" },
  { id: "CH-002", suite: "checkout", category: "Checkout", description: "Add new address", steps: "Fill address form, click Save", expected: "Address saved and selected" },
  { id: "CH-003", suite: "checkout", category: "Checkout", description: "Select saved address", steps: "Click on saved address card", expected: "Address selected, shipping rates fetched" },
  { id: "CH-004", suite: "checkout", category: "Checkout", description: "Calculate shipping rates", steps: "Enter valid postcode", expected: "Australia Post shipping rates displayed" },
  { id: "CH-005", suite: "checkout", category: "Checkout", description: "Apply coupon code", steps: "Enter valid coupon code, click Apply", expected: "Discount applied, total recalculated" },
  { id: "CH-006", suite: "checkout", category: "Checkout", description: "Invalid coupon code", steps: "Enter invalid coupon code, click Apply", expected: "Error message: invalid coupon" },
  { id: "CH-007", suite: "checkout", category: "Checkout", description: "Remove coupon", steps: "Click Remove on applied coupon", expected: "Discount removed, total updated" },
  { id: "CH-008", suite: "checkout", category: "Checkout", description: "Member gets free shipping", steps: "Login as member, check shipping", expected: "Free shipping displayed" },
  { id: "CH-009", suite: "checkout", category: "Checkout", description: "Add membership during checkout", steps: "Check \"Add Membership\" checkbox", expected: "Membership fee added to total" },
  { id: "CH-010", suite: "checkout", category: "Checkout", description: "Place order", steps: "Fill all required fields, click Place Order", expected: "Redirect to Stripe checkout" },
  { id: "CH-011", suite: "checkout", category: "Checkout", description: "Guest checkout", steps: "Checkout without logging in", expected: "Guest email field shown, order placed successfully" },
  { id: "CH-012", suite: "checkout", category: "Checkout", description: "Validation errors", steps: "Submit with empty fields", expected: "Validation errors on required fields" },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ORDERS & MEMBERSHIP
  // ═══════════════════════════════════════════════════════════════════════════════

  // ─── ORDERS: Order Management ────────────────────────────────────────────────
  { id: "O-001", suite: "orders", category: "Orders", description: "View order history", steps: "Navigate to /account/orders", expected: "List of orders with status displayed" },
  { id: "O-002", suite: "orders", category: "Orders", description: "View order details", steps: "Click on an order", expected: "Order details page with items, totals, status" },
  { id: "O-003", suite: "orders", category: "Orders", description: "Order confirmation page", steps: "Complete checkout, redirect to confirmation", expected: "Order summary displayed with thank you message" },
  { id: "O-004", suite: "orders", category: "Orders", description: "Cancel order", steps: "Click Cancel Order on pending order", expected: "Order cancelled, confirmation shown" },
  { id: "O-005", suite: "orders", category: "Orders", description: "Request refund", steps: "Click Request Refund on eligible order", expected: "Refund request submitted" },
  { id: "O-006", suite: "orders", category: "Orders", description: "Track order status", steps: "View order details", expected: "Current status and tracking info displayed" },
  { id: "O-007", suite: "orders", category: "Orders", description: "Order status notifications", steps: "Place order, wait for updates", expected: "Email/SMS notifications received" },
  { id: "O-008", suite: "orders", category: "Orders", description: "Reorder items", steps: "Click \"Buy Again\" on past order", expected: "Items added to cart" },

  // ─── MEMBERSHIP: Membership Plans ────────────────────────────────────────────
  { id: "M-001", suite: "membership", category: "Membership", description: "View membership page", steps: "Navigate to /account/membership", expected: "Membership plans and benefits displayed" },
  { id: "M-002", suite: "membership", category: "Membership", description: "Purchase membership", steps: "Click \"Buy Membership\", complete payment", expected: "Membership activated, user marked as member" },
  { id: "M-003", suite: "membership", category: "Membership", description: "Member pricing on products", steps: "Login as member, view products", expected: "Member prices shown on products" },
  { id: "M-004", suite: "membership", category: "Membership", description: "Member gets free shipping", steps: "Login as member, checkout", expected: "Free shipping applied" },
  { id: "M-005", suite: "membership", category: "Membership", description: "Membership status in profile", steps: "View profile as member", expected: "Active Member badge displayed" },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ADMIN PANEL
  // ═══════════════════════════════════════════════════════════════════════════════

  // ─── ADMIN: Authentication ─────────────────────────────────────────────────────
  { id: "A-001", suite: "admin-products", category: "Admin Auth", description: "Admin access required", steps: "Navigate to /admin without admin role", expected: "Redirect to login or access denied" },
  { id: "A-002", suite: "admin-products", category: "Admin Auth", description: "Admin login success", steps: "Login with admin credentials", expected: "Redirect to admin dashboard" },

  // ─── ADMIN: Products ───────────────────────────────────────────────────────────
  { id: "AP-001", suite: "admin-products", category: "Product Management", description: "View products list", steps: "Navigate to /admin/products", expected: "Products table with pagination displayed" },
  { id: "AP-002", suite: "admin-products", category: "Product Management", description: "Search products", steps: "Enter search term in products search", expected: "Filtered products displayed" },
  { id: "AP-003", suite: "admin-products", category: "Product Management", description: "Create new product", steps: "Click New Product, fill form, save", expected: "Product created, success message shown" },
  { id: "AP-004", suite: "admin-products", category: "Product Management", description: "Edit product", steps: "Click Edit on product, modify, save", expected: "Product updated, changes persisted" },
  { id: "AP-005", suite: "admin-products", category: "Product Management", description: "Delete product", steps: "Click Delete, confirm deletion", expected: "Product deleted, removed from list" },
  { id: "AP-006", suite: "admin-products", category: "Product Management", description: "Upload product images", steps: "Add images via image uploader", expected: "Images uploaded and previewed" },
  { id: "AP-007", suite: "admin-products", category: "Product Management", description: "Manage variants", steps: "Create variant attributes and values", expected: "Variants created successfully" },
  { id: "AP-008", suite: "admin-products", category: "Product Management", description: "Set member pricing", steps: "Enter member price for product", expected: "Member price saved" },

  // ─── ADMIN: Categories ───────────────────────────────────────────────────────
  { id: "AC-001", suite: "admin-products", category: "Category Management", description: "View categories", steps: "Navigate to /admin/categories", expected: "Categories list displayed" },
  { id: "AC-002", suite: "admin-products", category: "Category Management", description: "Create category", steps: "Click New Category, fill form, save", expected: "Category created" },
  { id: "AC-003", suite: "admin-products", category: "Category Management", description: "Edit category", steps: "Click Edit on category, modify, save", expected: "Category updated" },
  { id: "AC-004", suite: "admin-products", category: "Category Management", description: "Delete category", steps: "Click Delete, confirm", expected: "Category deleted" },

  // ─── ADMIN: Orders ─────────────────────────────────────────────────────────────
  { id: "AO-001", suite: "admin-orders", category: "Order Management", description: "View orders list", steps: "Navigate to /admin/orders", expected: "Orders table with status displayed" },
  { id: "AO-002", suite: "admin-orders", category: "Order Management", description: "Filter orders by status", steps: "Select status filter", expected: "Orders filtered by status" },
  { id: "AO-003", suite: "admin-orders", category: "Order Management", description: "Search orders", steps: "Enter order ID or customer name", expected: "Matching orders displayed" },
  { id: "AO-004", suite: "admin-orders", category: "Order Management", description: "View order details", steps: "Click on order", expected: "Order details with items, customer info displayed" },
  { id: "AO-005", suite: "admin-orders", category: "Order Management", description: "Update order status", steps: "Change status dropdown, save", expected: "Order status updated" },
  { id: "AO-006", suite: "admin-orders", category: "Order Management", description: "Add tracking number", steps: "Enter carrier and tracking number, save", expected: "Tracking info saved, customer notified" },
  { id: "AO-007", suite: "admin-orders", category: "Order Management", description: "Process refund", steps: "Click Refund, enter amount, confirm", expected: "Refund processed, status updated" },

  // ─── ADMIN: Customers ────────────────────────────────────────────────────────
  { id: "ACU-001", suite: "admin-customers", category: "Customer Management", description: "View customers list", steps: "Navigate to /admin/customers", expected: "Customers table displayed" },
  { id: "ACU-002", suite: "admin-customers", category: "Customer Management", description: "Search customers", steps: "Enter name or email in search", expected: "Matching customers displayed" },
  { id: "ACU-003", suite: "admin-customers", category: "Customer Management", description: "View customer details", steps: "Click on customer", expected: "Customer profile with orders displayed" },
  { id: "ACU-004", suite: "admin-customers", category: "Customer Management", description: "Toggle admin role", steps: "Click Admin toggle on customer", expected: "Customer role changed to/from admin" },
  { id: "ACU-005", suite: "admin-customers", category: "Customer Management", description: "Toggle membership", steps: "Click Member toggle on customer", expected: "Membership status toggled" },
  { id: "ACU-006", suite: "admin-customers", category: "Customer Management", description: "View customer orders", steps: "Click View Orders on customer", expected: "Customer's order history displayed" },

  // ─── ADMIN: Coupons ──────────────────────────────────────────────────────────
  { id: "ACP-001", suite: "admin-coupons", category: "Coupon Management", description: "View coupons list", steps: "Navigate to /admin/coupons", expected: "Coupons with usage stats displayed" },
  { id: "ACP-002", suite: "admin-coupons", category: "Coupon Management", description: "Create global coupon", steps: "Create coupon with type GLOBAL, set discount", expected: "Coupon created, applicable to all products" },
  { id: "ACP-003", suite: "admin-coupons", category: "Coupon Management", description: "Create product coupon", steps: "Create coupon, select specific products", expected: "Coupon created for selected products" },
  { id: "ACP-004", suite: "admin-coupons", category: "Coupon Management", description: "Create category coupon", steps: "Create coupon, select categories", expected: "Coupon created for selected categories" },
  { id: "ACP-005", suite: "admin-coupons", category: "Coupon Management", description: "Set coupon expiry", steps: "Set start and end dates for coupon", expected: "Coupon validity period set" },
  { id: "ACP-006", suite: "admin-coupons", category: "Coupon Management", description: "Set usage limits", steps: "Set total and per-user usage limits", expected: "Limits enforced during checkout" },
  { id: "ACP-007", suite: "admin-coupons", category: "Coupon Management", description: "Deactivate coupon", steps: "Toggle coupon active status", expected: "Coupon deactivated, cannot be used" },
  { id: "ACP-008", suite: "admin-coupons", category: "Coupon Management", description: "Delete coupon", steps: "Click Delete on coupon", expected: "Coupon deleted or deactivated if used" },

  // ─── ADMIN: Dashboard ────────────────────────────────────────────────────────
  { id: "AD-001", suite: "admin-products", category: "Dashboard", description: "View admin dashboard", steps: "Navigate to /admin", expected: "Dashboard with stats and recent orders" },
  { id: "AD-002", suite: "admin-products", category: "Dashboard", description: "View sales statistics", steps: "Check dashboard charts", expected: "Sales, orders, revenue stats displayed" },
  { id: "AD-003", suite: "admin-products", category: "Dashboard", description: "Quick navigation", steps: "Click quick links on dashboard", expected: "Navigate to respective admin sections" },

  // ═══════════════════════════════════════════════════════════════════════════════
  // BLOG (if implemented)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ─── BLOG: Blog Management ───────────────────────────────────────────────────
  { id: "B-001", suite: "blog", category: "Blog", description: "View blog posts", steps: "Navigate to /blog", expected: "Blog posts list displayed" },
  { id: "B-002", suite: "blog", category: "Blog", description: "View single post", steps: "Click on blog post", expected: "Full blog post content displayed" },
  { id: "B-003", suite: "blog", category: "Blog", description: "Create blog post (admin)", steps: "Create new post with title, content, category", expected: "Post published successfully" },
  { id: "B-004", suite: "blog", category: "Blog", description: "Edit blog post (admin)", steps: "Edit existing post content", expected: "Post updated successfully" },
  { id: "B-005", suite: "blog", category: "Blog", description: "Like blog post", steps: "Click like button on post", expected: "Like count increased" },
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
  profile: {
    label: "Profile Page",
    color: "bg-emerald-50 border-emerald-200",
    accent: "text-emerald-700",
    total: TEST_CASES.filter((t) => t.suite === "profile").length,
  },
  products: {
    label: "Products & Catalog",
    color: "bg-amber-50 border-amber-200",
    accent: "text-amber-700",
    total: TEST_CASES.filter((t) => t.suite === "products").length,
  },
  cart: {
    label: "Shopping Cart",
    color: "bg-pink-50 border-pink-200",
    accent: "text-pink-700",
    total: TEST_CASES.filter((t) => t.suite === "cart").length,
  },
  wishlist: {
    label: "Wishlist",
    color: "bg-rose-50 border-rose-200",
    accent: "text-rose-700",
    total: TEST_CASES.filter((t) => t.suite === "wishlist").length,
  },
  checkout: {
    label: "Checkout",
    color: "bg-cyan-50 border-cyan-200",
    accent: "text-cyan-700",
    total: TEST_CASES.filter((t) => t.suite === "checkout").length,
  },
  orders: {
    label: "Orders",
    color: "bg-indigo-50 border-indigo-200",
    accent: "text-indigo-700",
    total: TEST_CASES.filter((t) => t.suite === "orders").length,
  },
  membership: {
    label: "Membership",
    color: "bg-purple-50 border-purple-200",
    accent: "text-purple-700",
    total: TEST_CASES.filter((t) => t.suite === "membership").length,
  },
  "admin-products": {
    label: "Admin - Products",
    color: "bg-slate-50 border-slate-200",
    accent: "text-slate-700",
    total: TEST_CASES.filter((t) => t.suite === "admin-products").length,
  },
  "admin-orders": {
    label: "Admin - Orders",
    color: "bg-slate-50 border-slate-200",
    accent: "text-slate-700",
    total: TEST_CASES.filter((t) => t.suite === "admin-orders").length,
  },
  "admin-customers": {
    label: "Admin - Customers",
    color: "bg-slate-50 border-slate-200",
    accent: "text-slate-700",
    total: TEST_CASES.filter((t) => t.suite === "admin-customers").length,
  },
  "admin-coupons": {
    label: "Admin - Coupons",
    color: "bg-slate-50 border-slate-200",
    accent: "text-slate-700",
    total: TEST_CASES.filter((t) => t.suite === "admin-coupons").length,
  },
  blog: {
    label: "Blog",
    color: "bg-orange-50 border-orange-200",
    accent: "text-orange-700",
    total: TEST_CASES.filter((t) => t.suite === "blog").length,
  },
};
