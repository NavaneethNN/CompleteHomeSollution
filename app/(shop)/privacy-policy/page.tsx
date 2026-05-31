import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Complete Home Solution",
  description: "Learn how Complete Home Solution collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-muted-foreground mb-6">Last updated: May 31, 2026</p>

      <div className="prose prose-slate max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-muted-foreground mb-4">
            Complete Home Solution (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects your privacy and is committed to protecting your personal data. 
            This Privacy Policy explains how we collect, use, store, and protect your information when you use our website 
            and services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-medium mb-2">2.1 Personal Information</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Name, email address, phone number</li>
            <li>Shipping and billing addresses</li>
            <li>Payment information (processed securely via Stripe)</li>
            <li>Order history and purchase records</li>
            <li>Membership subscription details</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">2.2 Automatically Collected Information</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>IP address and browser information</li>
            <li>Device type and operating system</li>
            <li>Pages visited and time spent on site</li>
            <li>Cookies and similar technologies</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Process and fulfill your orders</li>
            <li>Send order confirmations and shipping updates via email/SMS</li>
            <li>Manage your membership subscription and benefits</li>
            <li>Provide customer support</li>
            <li>Send promotional offers (with your consent)</li>
            <li>Improve our website and services</li>
            <li>Prevent fraud and ensure security</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">4. Payment Processing</h2>
          <p className="text-muted-foreground mb-4">
            We use <strong>Stripe</strong> to process payments securely. Your payment information is encrypted and never 
            stored on our servers. Stripe is PCI DSS compliant and maintains the highest security standards.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">5. Communications</h2>
          <p className="text-muted-foreground mb-4">
            We send transactional emails and SMS messages for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Order confirmations</li>
            <li>Shipping and delivery updates</li>
            <li>Membership notifications</li>
            <li>Account verification</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            Marketing communications are sent only with your explicit consent and can be unsubscribed at any time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">6. Data Sharing</h2>
          <p className="text-muted-foreground mb-4">
            We share your information only with trusted third parties necessary to provide our services:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li><strong>Shipping partners</strong> (Shippit, Australia Post) - for delivery</li>
            <li><strong>Payment processors</strong> (Stripe) - for secure payments</li>
            <li><strong>Email/SMS services</strong> (Brevo, Twilio) - for notifications</li>
            <li><strong>Analytics providers</strong> - to improve our website</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            We never sell your personal information to third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">7. Data Security</h2>
          <p className="text-muted-foreground mb-4">
            We implement industry-standard security measures including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>SSL/TLS encryption for all data transmission</li>
            <li>Secure database storage with access controls</li>
            <li>Regular security audits and monitoring</li>
            <li>Two-factor authentication for admin access</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">8. Your Rights</h2>
          <p className="text-muted-foreground mb-4">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
            <li>Export your data</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            To exercise these rights, contact us at <a href="mailto:privacy@completehomesolution.com" className="text-primary hover:underline">privacy@completehomesolution.com</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">9. Cookies</h2>
          <p className="text-muted-foreground mb-4">
            We use cookies to enhance your browsing experience, remember your preferences, and analyze site traffic. 
            You can control cookies through your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">10. Changes to This Policy</h2>
          <p className="text-muted-foreground mb-4">
            We may update this Privacy Policy from time to time. Changes will be posted on this page with the updated date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Email: <a href="mailto:privacy@completehomesolution.com" className="text-primary hover:underline">privacy@completehomesolution.com</a></li>
            <li>Address: Complete Home Solution, Australia</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          By using our website, you consent to our Privacy Policy. If you do not agree, please do not use our services.
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/terms-of-service" className="text-primary hover:underline text-sm">Terms of Service</Link>
          <Link href="/refund-policy" className="text-primary hover:underline text-sm">Refund Policy</Link>
          <Link href="/shipping-policy" className="text-primary hover:underline text-sm">Shipping Policy</Link>
        </div>
      </div>
    </div>
  );
}
