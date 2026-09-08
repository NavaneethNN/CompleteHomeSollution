import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Complete Home Solution",
  description: "Terms and conditions for using Complete Home Solution website and services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      <p className="text-muted-foreground mb-6">Last updated: May 31, 2026</p>

      <div className="prose prose-slate max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Agreement to Terms</h2>
          <p className="text-muted-foreground mb-4">
            By accessing or using Complete Home Solution (&quot;the Site&quot;), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use our website or services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Definitions</h2>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li><strong>&quot;We&quot;, &quot;Us&quot;, &quot;Our&quot;</strong> refers to Complete Home Solution</li>
            <li><strong>&quot;You&quot;, &quot;User&quot;</strong> refers to any person accessing or using the Site</li>
            <li><strong>&quot;Products&quot;</strong> refers to furniture and home goods available for purchase</li>
            <li><strong>&quot;Membership&quot;</strong> refers to our subscription-based benefits program</li>
            <li><strong>&quot;Services&quot;</strong> refers to all features and functionality provided by the Site</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">3. Account Registration</h2>
          <p className="text-muted-foreground mb-4">
            To access certain features, you may need to create an account. You agree to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>Be responsible for all activities under your account</li>
            <li>Be at least 18 years old or have parental consent</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">4. Products and Pricing</h2>
          <h3 className="text-lg font-medium mb-2">4.1 Product Information</h3>
          <p className="text-muted-foreground mb-4">
            We strive to display accurate product information, including descriptions, images, and specifications. 
            However, we do not guarantee that all information is error-free. Colors may vary due to monitor differences.
          </p>

          <h3 className="text-lg font-medium mb-2">4.2 Pricing</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>All prices are in Australian Dollars (AUD) unless otherwise stated</li>
            <li>Prices are subject to change without notice</li>
            <li>Membership discounts apply only to active members</li>
            <li>We reserve the right to correct pricing errors</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">4.3 Availability</h3>
          <p className="text-muted-foreground mb-4">
            All products are subject to availability. We reserve the right to limit quantities or discontinue 
            products at any time. In case of stock unavailability after order placement, we will notify you and 
            provide a full refund.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">5. Orders and Payment</h2>
          <h3 className="text-lg font-medium mb-2">5.1 Order Placement</h3>
          <p className="text-muted-foreground mb-4">
            By placing an order, you make an offer to purchase the products. We reserve the right to accept or 
            decline any order. An order confirmation email does not constitute acceptance of your offer.
          </p>

          <h3 className="text-lg font-medium mb-2">5.2 Payment</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>We accept payments via Stripe (credit/debit cards)</li>
            <li>Payment is processed at the time of order placement</li>
            <li>You represent that you have the legal right to use the payment method</li>
            <li>All payment information is encrypted and secure</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">5.3 Order Cancellation</h3>
          <p className="text-muted-foreground mb-4">
            You may request order cancellation before the order is shipped. Once shipped, standard return policies apply.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">6. Membership Program</h2>
          <h3 className="text-lg font-medium mb-2">6.1 Membership Benefits</h3>
          <p className="text-muted-foreground mb-4">
            Our membership program provides exclusive benefits including discounts, early access to sales, 
            and special promotions. Benefits are subject to change.
          </p>

          <h3 className="text-lg font-medium mb-2">6.2 Membership Fees</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Membership fees are billed according to your selected plan (monthly/annual)</li>
            <li>Fees are non-refundable except as required by law</li>
            <li>You may cancel your membership at any time</li>
            <li>Cancellation takes effect at the end of the current billing period</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">6.3 Termination</h3>
          <p className="text-muted-foreground mb-4">
            We reserve the right to terminate memberships for violations of these terms or fraudulent activity.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">7. Shipping and Delivery</h2>
          <p className="text-muted-foreground mb-4">
            Shipping terms are governed by our <Link href="/shipping-policy" className="text-primary hover:underline">Shipping Policy</Link>. 
            Delivery times are estimates and not guaranteed. Risk of loss passes to you upon delivery.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">8. Returns and Refunds</h2>
          <p className="text-muted-foreground mb-4">
            Return and refund terms are governed by our <Link href="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>. 
            Please review this policy before making a purchase.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">9. Intellectual Property</h2>
          <p className="text-muted-foreground mb-4">
            All content on the Site, including text, images, logos, and designs, is our property or licensed to us. 
            You may not reproduce, distribute, or create derivative works without our express written permission.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">10. Prohibited Activities</h2>
          <p className="text-muted-foreground mb-4">
            You agree not to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Use the Site for any illegal purpose</li>
            <li>Interfere with the Site&apos;s security or operation</li>
            <li>Submit false or misleading information</li>
            <li>Attempt to gain unauthorized access to systems</li>
            <li>Use automated systems to access the Site</li>
            <li>Resell products without authorization</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">11. Limitation of Liability</h2>
          <p className="text-muted-foreground mb-4">
            To the maximum extent permitted by law, we shall not be liable for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Indirect, incidental, or consequential damages</li>
            <li>Loss of profits, data, or goodwill</li>
            <li>Service interruptions or technical failures</li>
            <li>Third-party actions or content</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            Our total liability shall not exceed the amount paid for the specific product or service giving rise to the claim.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">12. Indemnification</h2>
          <p className="text-muted-foreground mb-4">
            You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from your 
            use of the Site or violation of these Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">13. Governing Law</h2>
          <p className="text-muted-foreground mb-4">
            These Terms are governed by the laws of Australia. Any disputes shall be resolved in the courts of Australia.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">14. Changes to Terms</h2>
          <p className="text-muted-foreground mb-4">
            We may update these Terms at any time. Changes will be effective upon posting. Continued use of the Site 
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">15. Contact Information</h2>
          <p className="text-muted-foreground mb-4">
            For questions about these Terms, please contact us:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Email: <a href="mailto:legal@completehomesolution.com" className="text-primary hover:underline">legal@completehomesolution.com</a></li>
            <li>Address: Complete Home Solution, 18 Edison Drive, Golden Grove SA 5125</li>
            <li>ABN: 52 921 008 361</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          These Terms of Service constitute the entire agreement between you and Complete Home Solution regarding the use of our website and services.
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/privacy-policy" className="text-primary hover:underline text-sm">Privacy Policy</Link>
          <Link href="/refund-policy" className="text-primary hover:underline text-sm">Refund Policy</Link>
          <Link href="/shipping-policy" className="text-primary hover:underline text-sm">Shipping Policy</Link>
        </div>
      </div>
    </div>
  );
}
