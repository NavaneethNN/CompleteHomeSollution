import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping Policy | Complete Home Solution",
  description: "Learn about our shipping methods, delivery times, and costs.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Shipping Policy</h1>
      <p className="text-muted-foreground mb-6">Last updated: May 31, 2026</p>

      <div className="prose prose-slate max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">1. Shipping Overview</h2>
          <p className="text-muted-foreground mb-4">
            Complete Home Solution delivers furniture and home goods across Australia. 
            We partner with trusted carriers including Australia Post and Shippit to ensure 
            your orders arrive safely and on time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">2. Shipping Methods</h2>
          <h3 className="text-lg font-medium mb-2">2.1 Standard Delivery</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Delivery to your door or ground floor entrance</li>
            <li>Carrier: Australia Post or Shippit</li>
            <li>Tracking provided via email and SMS</li>
            <li>Signature required for high-value items</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">2.2 White Glove Delivery</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Available for large furniture items (sofas, beds, dining sets)</li>
            <li>Delivery to room of choice</li>
            <li>Basic assembly included where applicable</li>
            <li>Packaging removal service</li>
            <li>Additional fee applies - calculated at checkout</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">2.3 Express Delivery</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Available for select smaller items</li>
            <li>Faster delivery to metropolitan areas</li>
            <li>Additional fee applies</li>
            <li>Not available for bulky furniture</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">3. Delivery Timeframes</h2>
          <h3 className="text-lg font-medium mb-2">3.1 Standard Delivery Times</h3>
          <table className="w-full text-sm text-muted-foreground mb-4 border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Location</th>
                <th className="text-left py-2">Estimated Delivery</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Sydney, Melbourne, Brisbane Metro</td>
                <td className="py-2">3-5 business days</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Other Major Cities (Perth, Adelaide, Hobart)</td>
                <td className="py-2">5-7 business days</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Regional Areas</td>
                <td className="py-2">7-12 business days</td>
              </tr>
              <tr>
                <td className="py-2">Remote Areas</td>
                <td className="py-2">10-15 business days</td>
              </tr>
            </tbody>
          </table>
          <p className="text-muted-foreground mb-4 text-sm">
            *Delivery times are estimates and may vary due to factors beyond our control including weather, 
            carrier delays, and peak seasons.
          </p>

          <h3 className="text-lg font-medium mb-2">3.2 Order Processing Time</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Orders are processed within 1-2 business days</li>
            <li>Custom or made-to-order items: 2-4 weeks processing</li>
            <li>Orders placed on weekends/holidays process next business day</li>
            <li>You will receive a confirmation email with tracking information once shipped</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">4. Shipping Costs</h2>
          <h3 className="text-lg font-medium mb-2">4.1 Free Shipping</h3>
          <p className="text-muted-foreground mb-4">
            Free standard shipping is available for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Orders over $500 (Australia-wide)</li>
            <li>Membership holders (all orders, no minimum)</li>
            <li>Select promotional items (marked on product page)</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">4.2 Standard Shipping Rates</h3>
          <table className="w-full text-sm text-muted-foreground mb-4 border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order Value</th>
                <th className="text-left py-2">Standard Shipping</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Under $100</td>
                <td className="py-2">$15.00</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">$100 - $299</td>
                <td className="py-2">$25.00</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">$300 - $499</td>
                <td className="py-2">$35.00</td>
              </tr>
              <tr>
                <td className="py-2">$500 and above</td>
                <td className="py-2">FREE</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-medium mb-2">4.3 Additional Fees</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li><strong>White Glove Delivery:</strong> $80 - $150 depending on item size and location</li>
            <li><strong>Express Delivery:</strong> $25 - $50 depending on item and location</li>
            <li><strong>Remote Area Surcharge:</strong> Additional $30 - $80 for certain remote postcodes</li>
            <li><strong>Redelivery Fee:</strong> $25 if delivery fails due to incorrect address or no one available</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">5. Delivery Process</h2>
          <h3 className="text-lg font-medium mb-2">5.1 Tracking Your Order</h3>
          <p className="text-muted-foreground mb-4">
            Once your order ships, you will receive:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Email with tracking number and carrier information</li>
            <li>SMS notifications for key delivery milestones</li>
            <li>Ability to track via <Link href="/account/orders" className="text-primary hover:underline">your account</Link></li>
          </ul>

          <h3 className="text-lg font-medium mb-2">5.2 Delivery Day</h3>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Someone must be available to accept delivery (or provide Authority to Leave)</li>
            <li>Driver will call 30-60 minutes before arrival when possible</li>
            <li>Inspect items for visible damage before signing</li>
            <li>Note any damage on the delivery receipt if found</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">5.3 Authority to Leave (ATL)</h3>
          <p className="text-muted-foreground mb-4">
            You can provide Authority to Leave if you won&apos;t be home:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Specify safe location during checkout or via tracking link</li>
            <li>Small items may be left without signature if safe</li>
            <li>High-value items require signature (ATL not available)</li>
            <li>You assume responsibility for items left unattended</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">6. Delivery Restrictions</h2>
          <h3 className="text-lg font-medium mb-2">6.1 Access Requirements</h3>
          <p className="text-muted-foreground mb-4">
            Please ensure:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Clear path from delivery vehicle to delivery point</li>
            <li>Doorways and stairways can accommodate item dimensions</li>
            <li>Elevator access for high-rise buildings (if applicable)</li>
            <li>No obstacles that may prevent safe delivery</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            If delivery cannot be completed due to access issues, a redelivery fee will apply.
          </p>

          <h3 className="text-lg font-medium mb-2">6.2 PO Boxes and Parcel Lockers</h3>
          <p className="text-muted-foreground mb-4">
            We cannot deliver to PO Boxes or parcel lockers for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Items over 20kg</li>
            <li>Items over 1 meter in any dimension</li>
            <li>Bulky furniture items</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">7. International Shipping</h2>
          <p className="text-muted-foreground mb-4">
            Currently, we only ship within Australia. International shipping is not available at this time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">8. Delayed or Lost Shipments</h2>
          <h3 className="text-lg font-medium mb-2">8.1 Delivery Delays</h3>
          <p className="text-muted-foreground mb-4">
            If your delivery is delayed:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Check tracking information for updates</li>
            <li>Allow 2 additional business days beyond estimated date</li>
            <li>Contact us if delayed more than 5 business days</li>
            <li>We will investigate and provide updates</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">8.2 Lost Packages</h3>
          <p className="text-muted-foreground mb-4">
            If tracking shows no movement for 7+ days:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Contact us immediately to initiate an investigation</li>
            <li>We will file a claim with the carrier</li>
            <li>Replacement or refund provided once carrier confirms loss</li>
            <li>Investigation may take 10-15 business days</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">9. Special Circumstances</h2>
          <h3 className="text-lg font-medium mb-2">9.1 Peak Seasons</h3>
          <p className="text-muted-foreground mb-4">
            During peak seasons (Christmas, Boxing Day, Easter), expect:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Extended delivery times (add 2-3 business days)</li>
            <li>Higher shipping volumes may cause delays</li>
            <li>Order early to ensure timely delivery</li>
          </ul>

          <h3 className="text-lg font-medium mb-2">9.2 Extreme Weather</h3>
          <p className="text-muted-foreground mb-4">
            Deliveries may be delayed due to floods, fires, or severe storms. 
            We prioritize safety and will resume deliveries once conditions permit.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">10. Contact Us</h2>
          <p className="text-muted-foreground mb-4">
            For shipping-related questions:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">
            <li>Email: <a href="mailto:shipping@completehomesolution.com" className="text-primary hover:underline">shipping@completehomesolution.com</a></li>
            <li>Hours: Monday-Friday, 9 AM - 5 PM AEST</li>
            <li>Response time: Within 24 business hours</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t">
        <p className="text-sm text-muted-foreground">
          By placing an order, you agree to the terms of this Shipping Policy.
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/privacy-policy" className="text-primary hover:underline text-sm">Privacy Policy</Link>
          <Link href="/terms-of-service" className="text-primary hover:underline text-sm">Terms of Service</Link>
          <Link href="/refund-policy" className="text-primary hover:underline text-sm">Refund Policy</Link>
        </div>
      </div>
    </div>
  );
}
