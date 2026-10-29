# Test catalog seed

`scripts/seed-test-catalog.ts` updates existing products and variants in the database selected by the application's environment configuration. It does not create catalog items.

```sh
# Preview all proposed values without writing
node --import tsx scripts/seed-test-catalog.ts

# Back up existing fields, apply in one transaction, and verify every field
node --import tsx scripts/seed-test-catalog.ts --apply
```

The reviewed catalog contains 14 products and 30 variants. Test prices are in AUD, weights in kg, and packed dimensions in cm. Member prices are 15% below regular prices; compare prices are 20% above regular prices. Parent products with variants use the lowest-priced variant's price and package profile. Size variants have different weights and dimensions; colour-only changes retain the same parcel measurements.

The script prints its local JSON backup path before writing and rolls back if an existing record changes after the initial read or if field verification fails. The backup contains previous pricing and shipping fields, without database credentials. Stock, status, names, images, and existing order prices are not updated.

These are synthetic testing estimates, not verified supplier or courier measurements. Large furniture sets use a consolidated freight envelope because the current product schema supports only one parcel profile per sellable unit. Actual multi-carton fulfilment requires measured carton data and a corresponding packing model. Some large furniture will require freight rather than a parcel courier.

For shipping comparisons, use a non-member cart below AUD 1,200. Suggested test items:

| Item | Regular price | Weight | Packed length × width × height |
| --- | --- | --- | --- |
| Floating Nightstand | 189 | 6 kg | 50 × 36 × 18 cm |
| Entry Console Table | 269 | 15 kg | 128 × 43 × 20 cm |
| Ergonomic Office Chair | 449 | 18 kg | 75 × 65 × 40 cm |
| Scandinavian Coffee Table | 299 | 20 kg | 118 × 68 × 20 cm |

Setting different dimensions does not guarantee destination-dependent prices from Ship123. Compare its actual quote responses for the same parcel and service.
