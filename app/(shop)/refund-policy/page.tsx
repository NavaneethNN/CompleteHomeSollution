import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund & Return Policy | Complete Home Solution",
  description: "Learn about our return and refund policies for furniture purchases.",
};

export default function RefundPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Refund & Return Policy</h1>
      <p className="text-muted-foreground mb-6">Last updated: May 31, 2026</p>

      <div className="prose prose-slate max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Overview</h2>
          <p className="text-muted-foreground mb-4">
            At Complete Home Solution, we want you to be completely satisfied with your purchase. 
            If you&apos;re not happy with your furniture, we offer a straightforward return and refund process. 
            Please read this policy carefully before making a purchase.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Return Eligibility</h2>
          <h3 className="text-lg font-medium mb-2">2.1 Standard Returns</h3>
          <p className="text-muted-foreground mb-4">
            You may return most items within <strong>30 days</strong> of delivery for a full refund, subject to the following conditions:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Item must be in original condition and unused</li>
            <li>Original packaging must be intact</li>
            <li>All accessories, manuals, and parts must be included</li>
            <li>Proof of purchase (order number or receipt) is required</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">2.2 Non-Returnable Items</h3>
          <p className="text-muted-foreground mb-4">
            The following items cannot be returned:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Custom-made or personalized furniture</li>
            <li>Items marked as &quot;Final Sale&quot; or &quot;Clearance&quot;</li>
            <li>Mattresses and bedding products (hygiene reasons)</li>
            <li>Items damaged due to customer misuse or negligence</li>
            <li>Assembled furniture that has been modified</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">3. Return Process</h2>
          <h3 className="text-lg font-medium mb-2">3.1 How to Initiate a Return</h3>
          <ol className="list-decimal list-inside text-muted-foreground mb-4 space-y-2">
            <li>Log into your account and go to <Link href="/account/orders" className="text-primary hover:underline">Order History</Link></li>
            <li>Select the order containing the item you wish to return</li>
            <li>Click &quot;Request Return&quot; and follow the prompts</li>
            <li>Provide reason for return and upload photos if applicable</li>
            <li>Wait for return authorization (typically 1-2 business days)</li>
          </ol>

          <h3 className="text-lg font-medium mb-2">3.2 Return Shipping</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li><strong>Customer responsibility:</strong> Return shipping costs are the customer&apos;s responsibility unless the item is defective or incorrect</li>
            <li><strong>Pickup service:</strong> We offer a pickup service for large items (fees apply)</li>
            <li><strong>Packaging:</strong> Items must be securely packaged to prevent damage during transit</li>
            <li><strong>Insurance:</strong> We recommend insuring high-value returns</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">4. Refund Process</h2>
          <h3 className="text-lg font-medium mb-2">4.1 Refund Timeline</h3>
          <table className="w-full text-sm text-muted-foreground mb-4 border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Stage</th>
                <th className="text-left py-2">Timeline</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Return request submitted</td>
                <td className="py-2">Day 0</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Return authorization issued</td>
                <td className="py-2">1-2 business days</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Item received at warehouse</td>
                <td className="py-2">3-7 business days (shipping)</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Item inspection</td>
                <td className="py-2">1-2 business days</td>
              </tr>
              <tr>
                <td className="py-2">Refund processed</td>
                <td className="py-2">3-5 business days after approval</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-medium mb-2">4.2 Refund Method</h3>
          <p className="text-muted-foreground mb-4">
            Refunds will be issued to the original payment method:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Credit/Debit cards: Refund to original card (5-10 business days to appear)</li>
            <li>Store credit: Available immediately for future purchases</li>
            <li>Membership fees: Non-refundable except as required by law</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">5. Damaged or Defective Items</h2>
          <h3 className="text-lg font-medium mb-2">5.1 Reporting Damage</h3>
          <p className="text-muted-foreground mb-4">
            If your item arrives damaged or defective:
          </p>
          <ol className="list-decimal list-inside text-muted-foreground mb-4 space-y-2">
            <li>Report within <strong>48 hours</strong> of delivery</li>
            <li>Take clear photos of the damage and packaging</li>
            <li>Contact customer service at <a href="mailto:support@completehomesolution.com" className="text-primary hover:underline">support@completehomesolution.com</a></li>
            <li>Do not dispose of the item or packaging until instructed</li>
          </ol>

          <h3 className="text-lg font-medium mb-2">5.2 Resolution Options</h3>
          <p className="text-muted-foreground mb-4">
            For damaged/defective items, we offer:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Full refund including return shipping</li>
            <li>Free replacement with same or equivalent item</li>
            <li>Partial refund for minor cosmetic issues (with customer consent)</li>
            <li>Repair service for items that can be fixed</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">6. Incorrect Items</h2>
          <p className="text-muted-foreground mb-4">
            If you receive the wrong item:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Report within 7 days of delivery</li>
            <li>We will arrange free return shipping</li>
            <li>Correct item will be shipped at no additional cost</li>
            <li>Optional refund if replacement is not desired</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">7. Order Cancellation</h2>
          <h3 className="text-lg font-medium mb-2">7.1 Before Shipment</h3>
          <p className="text-muted-foreground mb-4">
            Orders can be cancelled before shipment for a full refund:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Log into your account and select the order</li>
            <li>Click &quot;Cancel Order&quot; if the option is available</li>
            <li>Or contact customer service for assistance</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">7.2 After Shipment</h3>
          <p className="text-muted-foreground mb-4">
            Once an order has shipped, cancellation is not possible. You may refuse delivery or 
            return the item following our standard return process.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">8. Membership Cancellations</h2>
          <p className="text-muted-foreground mb-4">
            Membership subscriptions can be cancelled at any time:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Cancellation takes effect at the end of the current billing period</li>
            <li>Membership benefits continue until the end of the paid period</li>
            <li>Membership fees are non-refundable except as required by law</li>
            <li>To cancel, go to <Link href="/account/membership" className="text-primary hover:underline">Account &gt; Membership</Link></li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">9. Restocking Fees</h2>
          <p className="text-muted-foreground mb-4">
            A restocking fee may apply in the following situations:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Returns without original packaging: 10% fee</li>
            <li>Items requiring extensive repackaging: 15% fee</li>
            <li>Returns initiated after 30 days (if accepted): 20% fee</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">10. Warranty Information</h2>
          <p className="text-muted-foreground mb-4">
            All furniture comes with a standard manufacturer warranty:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Structural defects: 12 months from delivery</li>
            <li>Upholstery and finishes: 6 months from delivery</li>
            <li>Hardware and mechanisms: 12 months from delivery</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            Warranty claims do not fall under standard returns. Please contact us for warranty service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            For return-related questions or assistance:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Email: <a href="mailto:returns@completehomesolution.com" className="text-primary hover:underline">returns@completehomesolution.com</a></li>
            <li>Hours: Monday-Friday, 9 AM - 5 PM AEST</li>
            <li>Response time: Within 24 business hours</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          By making a purchase, you acknowledge that you have read and agree to this Refund & Return Policy.
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/privacy-policy" className="text-primary hover:underline text-sm">Privacy Policy</Link>
          <Link href="/terms-of-service" className="text-primary hover:underline text-sm">Terms of Service</Link>
          <Link href="/shipping-policy" className="text-primary hover:underline text-sm">Shipping Policy</Link>
        </div>
      </div>
    </div>
  );
}
