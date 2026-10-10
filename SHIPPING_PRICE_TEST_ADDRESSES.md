# Australian shipping price test addresses

Sender configured in `.env`: **18 Edison Drive, Golden Grove, SA 5125, Australia**.

These public venue addresses cover five cities at different distances from the sender. Use them for quote testing only; do not submit actual delivery orders to these venues.

## Addresses to enter

Use **Shipping Test** as the recipient name, leave address line 2 blank, and select **Australia (AU)** for every address. If contact details are required, use your own test contact details.

Distances below are rough straight-line estimates from Golden Grove for comparison, not measured road distances or courier routes.

| City / test | Address line 1 | Suburb / city field | State | Postcode | Approximate distance from sender |
| --- | --- | --- | --- | --- | --- |
| Adelaide — nearby | 128 King William Street | Adelaide | SA | 5000 | 25 km |
| Melbourne — interstate | 90-130 Swanston Street | Melbourne | VIC | 3000 | 650 km |
| Sydney — farther east | 483 George Street | Sydney | NSW | 2000 | 1,150 km |
| Brisbane — long distance | 64 Adelaide Street | Brisbane City | QLD | 4000 | 1,580 km |
| Perth — across the country | 601 Hay Street | Perth | WA | 6000 | 2,150 km |

Official address sources: [Adelaide Town Hall](https://www.adelaidetownhall.com.au/contact), [Melbourne Town Hall](https://whatson.melbourne.vic.gov.au/things-to-do/melbourne-town-hall), [Sydney Town Hall](https://www.cityofsydney.nsw.gov.au/landmarks/sydney-town-hall), [Brisbane City Hall](https://heritage.brisbane.qld.gov.au/heritage-places/288), and [Perth Town Hall](https://www.perth.wa.gov.au/hire-and-bookings/all-venues/perth-town-hall---main-hall).

## How to compare

1. Use guest checkout or an account without an active membership. Keep the cart subtotal **below AUD 1,200**: the current checkout grants free shipping to active members and orders at or above that threshold.
2. Keep the same products, variants, and quantities for all five tests. Choose products with valid shipping weight and dimensions so a parcel quote can be calculated.
3. Enter each complete address and wait for shipping rates to finish loading. Compare the **same courier/service** wherever available; the cheapest option may be a different service for each destination.
4. Record the displayed AUD price and any unavailable services or errors below. Return to Adelaide after testing Perth to check that the quote refreshes back to the original destination.
5. To verify correctness, compare against a Ship123 quote using the same sender, destination, service, parcel weights, dimensions, and parcel count. Account for currency conversion if the provider quote is not in AUD.

Price variation alone does not prove correctness. Rates can depend on service, delivery zone, and parcel details; two destinations can share a price, and a farther destination need not cost more.

Implementation note: `lib/ship123.ts` currently sends the destination and parcel details to the quote endpoint, without an explicit sender address. Confirm the origin configured in Ship123 matches Golden Grove before interpreting these as quotes from that sender.

## Results

Cart / quantities: ____________________

Test date: ____________________

| Destination | Courier / service | Checkout price (AUD) | Provider comparison (AUD) | Notes / errors |
| --- | --- | --- | --- | --- |
| Adelaide | | | | |
| Melbourne | | | | |
| Sydney | | | | |
| Brisbane | | | | |
| Perth | | | | |
| Adelaide repeat | | | | |
