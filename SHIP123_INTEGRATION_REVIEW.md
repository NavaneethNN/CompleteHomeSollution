# Ship123 API review and quote verification

Reviewed on 10 October 2026 against all eight pages in the [official documentation index](https://ship123-api.readme.io/llms.txt): introduction, products, calculation, order creation, order details, cancellation, scan-form creation, and scan-form lookup.

## Findings and changes

- The [quote API](https://ship123-api.readme.io/reference/calculateorderusingpost) supports `shipFrom`. It is optional in the published schema, but checkout now sends the configured `SHIP123_SENDER_*` address so its origin matches order creation. Missing sender configuration produces an explicit error.
- `bsFlag: 0` means centimetres and kilograms. Existing parcel dimensions, weights, and quantities already follow that contract.
- The [product-list response](https://ship123-api.readme.io/reference/listavailableproductusingpost) documents `productCode` and `productName`, without guaranteeing `customCarrier`. Known Australia Post codes now remain eligible when that extra field is absent. Ambiguous automatic services remain excluded; unknown carrier-less codes still require a verified carrier mapping.
- When the provider returns a service code as its name, checkout now displays a readable name such as “Australia Post Express”.
- `totalPrice` and `currencyCode` are the documented quote amount and currency. The integration reads these fields. `declaredCurrency` means the currency of declared goods value; it is not documented as a way to select the returned freight currency. USD quotes continue to be converted to AUD.
- API-key validation now happens outside the network-error handler, preserving the configuration error instead of reporting it as an unreachable provider.
- Order creation and detail lookup use the documented endpoints and fields. Cancellation and scan forms are separate fulfilment actions and are not needed to obtain checkout quotes.

## Live verification after the changes

Used the locally configured API credential with the updated application function `calculateShip123Rate`, which sends the configured Golden Grove SA 5125 sender. Production credentials have not been compared with this credential.

Test parcel: **one package, 20 × 15 × 10 cm, 1 kg**. These are controlled test dimensions, not the Floating Nightstand's packaged dimensions. All calls were quote-only; no orders, labels, cancellations, or scan forms were created.

| Destination | Service | Raw quote | Provider trace ID |
| --- | --- | --- | --- |
| Adelaide SA 5000 | AU_POST_EPARCEL | USD 2 | `bbecb94f3a824c1da5602ec2cf87e7c2` |
| Adelaide SA 5000 | AU_POST_EXPRESS | USD 2 | `a014e6c936fe4dfebf1dc6a74942600e` |
| Adelaide SA 5000 | AU_POST_STANDARD | USD 2 | `a9e7bc5f8b0e447e8c75a7a465d15b2e` |
| Melbourne VIC 3000 | AU_POST_EPARCEL | USD 2 | `f6e3d5d91f6a418aa59f67d1722c5fae` |
| Melbourne VIC 3000 | AU_POST_EXPRESS | USD 2 | `bb5ed2d358dc445697cb428f47ec3712` |
| Melbourne VIC 3000 | AU_POST_STANDARD | USD 2 | `c56a331f04874929a2a748b0ebdf6dc3` |
| Sydney NSW 2000 | AU_POST_EPARCEL | USD 2 | `6f7a4a0a12f3493696c7392b2ad6d96b` |
| Sydney NSW 2000 | AU_POST_EXPRESS | USD 2 | `4c4b6d4aa61d43bebf5dd90a2c8d2a7f` |
| Sydney NSW 2000 | AU_POST_STANDARD | USD 2 | `df92553ecd754b999ee27f36a6f486d7` |

Each successful response reports `chargeWeight: 1`, `chargeWeightUnit: "kg"`, and one fee named `基础运费` (base freight), with `feeValue: 2` and `currencyCode: "USD"`.

## What remains unresolved

The provider still returns identical amounts across these destinations and services with the explicit sender. The public reference does not specify the account's tariff, origin fallback, or why these services share prices. It does not establish that the customer's displayed AUD 11.46 is correct for the actual product.

Send Ship123 the trace IDs above and ask them to verify the account's live Australian rate tables, origin handling, billing currency, and service-specific pricing. Compare a dashboard quote using exactly the same parcel and addresses. Do not introduce distance surcharges or change the returned currency label to make prices differ.

Production deployment must include the same valid `SHIP123_SENDER_*` fields used for fulfilment, including the sender street, suburb, state, postcode, name, and phone.
