Raffle Management System – Complete Workflow & Features
Objective: Develop a complete raffle system integrated into the existing e-commerce website. Admins can create and manage raffle campaigns, while customers can browse eligible raffles, participate and track their entries and results.
1. Admin Panel – Raffle Management
A. Create Raffle
Basic Information
- Raffle title
- Short and detailed description
- Prize name
- Prize images / gallery
- Prize value (₹)
- Prize quantity / number of winners
Participation Settings
- Entry price: Free / Paid (₹ amount)
- Visibility: Everyone / Members only
- Eligible membership plans: All / Selected plans
- Maximum entries per customer
- Minimum entries per customer (optional)
- Total maximum entries for the raffle
- Allow multiple entries: Yes / No
Schedule Settings
- Raffle start date and time
- Entry closing date and time
- Winner draw date and time
- Automatic closure: Yes / No
- Campaign status: Draft / Published
Winner Settings
- Number of winners
- Winner selection method
- Random selection with auditable results
- Winner verification deadline
- Replacement winner option
- Winner announcement: Automatic / Manual approval
Additional Settings
- Terms and conditions
- Age restrictions (if applicable)
- Geographic restrictions
- Shipping availability
- Featured raffle: Yes / No
- Display on homepage: Yes / No
B. Manage Published Raffles
- View all raffles with status.
- View total participants and entries.
- View individual customer participation.
- View and export ticket numbers.
- Pause / Resume raffle.
- Close raffle.
- Conduct winner draw.
- Verify and approve winners.
- Publish winner announcements.
- Manage prize delivery status.
- View participation and campaign reports.
2. Customer Website – Raffle Experience
A. Raffle Listing Page
Display:
- Active raffles
- Upcoming raffles
- Completed raffles
- Featured raffles
Each raffle card should display:
- Prize image
- Raffle title
- Prize value
- Entry price (Free / ₹ amount)
- Entries sold / total entries
- Closing date
- Countdown timer
- View Details button
B. Raffle Details Page
Display:
- Prize images and complete description
- Prize value
- Entry price
- Campaign start and closing dates
- Draw date
- Total entries and available entries
- Maximum entries per customer
- Eligibility requirements
- Terms and conditions
C. Customer Participation
1. Customer opens a raffle.
2. System checks login status.
3. System verifies membership eligibility (if required).
4. Customer selects the number of entries.
5. System validates entry limits and remaining availability.
6. Customer confirms participation.
7. If paid participation is legally permitted, process payment.
8. Generate unique raffle ticket numbers.
9. Display successful participation confirmation.
D. My Raffles – Customer Dashboard
Create a dedicated section in the customer account.

Tabs:
- My Active Raffles
- Upcoming Draws
- My Tickets
- Completed Raffles
- My Wins
For every participation, display:
- Raffle name and prize image
- Number of entries
- Unique ticket numbers
- Participation date
- Payment status (if applicable)
- Raffle status
- Draw date
- Winner result
E. Winner Announcement
- Display winning raffle details.
- Display winning ticket number.
- Display winner name according to privacy settings.
- Notify the winner through email / SMS / website notification.
- Allow winner verification.
- Display prize fulfilment and delivery status.
3. Complete Customer Workflow
1. Customer Login / Registration
2. Open Raffle Section
3. Browse Available Raffles
4. Select a Raffle
5. Membership & Eligibility Verification
6. Select Number of Entries
7. Confirm Participation / Payment
8. Generate Unique Tickets
9. View Tickets in My Raffles
10. Wait for Winner Draw
11. Receive Winner Announcement
12. Winner Verification & Prize Delivery

4. Complete Raffle Status Workflow
DRAFT
  ↓
UPCOMING
  ↓
ACTIVE
  ↓
CLOSED
  ↓
DRAW PENDING
  ↓
DRAW COMPLETED
  ↓
WINNER VERIFICATION
  ↓
COMPLETED


Additional statuses: PAUSED, CANCELLED.
5. Database Architecture
Create separate raffle-related tables and reuse the existing users and membership tables.
Table	Purpose
raffles	Campaign information and settings
raffle_prizes	Prize details and images
raffle_eligibility	Membership eligibility
raffle_entries	Customer participation records
raffle_tickets	Unique ticket numbers
raffle_winners	Selected winners
raffle_draws	Draw records and audit information
raffle_fulfilment	Prize delivery tracking
raffle_audit_logs	Admin activity history

6. Important Technical Requirements
- Integrate with existing authentication and membership systems.
- Never duplicate existing user or membership records.
- Perform eligibility validation on the backend.
- Prevent duplicate participation and ticket generation.
- Use database transactions for entry creation.
- Enforce maximum customer and campaign entry limits.
- Handle payment confirmation through verified webhooks, if applicable.
- Use secure random selection where legally permitted.
- Maintain transparent and auditable draw records.
- Implement role-based admin permissions.
- Ensure responsive mobile and desktop interfaces.
- Include proper loading, error, empty and success states.
7. Development Instructions for AI
Develop the complete Raffle Management System described above within the existing e-commerce application.

First inspect the existing project architecture, technology stack, database schema, authentication, membership system, payment integration and UI conventions.

Implement both:
1. Admin-side Raffle Management.
2. Customer-side Raffle Participation and Dashboard.
Keep the raffle module independent and modular while reusing existing application services.

Do not unnecessarily modify existing e-commerce functionality.

Implement database migrations, backend APIs, frontend pages, validation, permissions, notifications and audit logging.

Follow the complete customer journey from browsing a raffle to participation, ticket generation, winner announcement and prize fulfilment.

Test the complete end-to-end workflow, including membership eligibility, entry limits, concurrent participation, duplicate requests, payment failures (if applicable), campaign closure and winner selection.

Use realistic empty states, loading states, error handling and responsive designs.

Do not enable paid-entry random prize draws until legal approval has been obtained for the applicable jurisdiction. Support legally reviewed free promotional campaigns where permitted.




Important: Build both customer and admin sides together. A raffle should be a complete lifecycle module, not simply a form to create campaigns.