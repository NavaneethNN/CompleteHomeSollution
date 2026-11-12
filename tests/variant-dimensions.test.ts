import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import {
  resolveVariantCustomerDimensions,
  withVariantCourierDimensions,
} from "../lib/variant-dimensions";

const require = createRequire(import.meta.url);
function stub(path: string, exports: unknown) {
  require.cache[require.resolve(path)] = { exports } as NodeModule;
}

let capturedCourierGroups: any[] = [];
let mockShippingProducts: any[] = [];
let manualDeliveryRate: { available: boolean; charge: number; suburb?: string | null } | null = null;
const capturedVariantCreates: any[] = [];
const capturedVariantUpdates: any[] = [];

const productId = "c123456789012345678901234";
const smallBoxVariantId = "c223456789012345678901234";
const productOnlyVariantId = "c323456789012345678901234";
const heavyParcelVariantId = "c423456789012345678901234";

const dbMock = {
  product: {
    findMany: async () => structuredClone(mockShippingProducts),
    findUnique: async ({ where }: any) => {
      if (where?.slug) return null;
      return {
        id: productId,
        name: "Oak Dining Table",
        slug: "oak-dining-table",
        sku: "OAK-TBL",
        basePrice: 899,
        hasVariants: true,
        variantAttributes: [],
        productVariants: [{ id: smallBoxVariantId, sku: "OAK-TBL-S" }],
      };
    },
    findFirst: async () => null,
    create: async ({ data }: any) => ({ id: productId, ...data }),
    update: async ({ data }: any) => ({ id: productId, ...data }),
  },
  variantAttribute: {
    findMany: async () => [],
    create: async ({ data }: any) => ({ id: "attr-1", ...data }),
    update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    delete: async () => ({}),
  },
  variantValue: {
    create: async ({ data }: any) => ({ id: "val-1", ...data }),
    update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    delete: async () => ({}),
  },
  productVariant: {
    findMany: async () => [{ id: smallBoxVariantId, sku: "OAK-TBL-S", values: [], images: [] }],
    count: async () => 1,
    create: async ({ data }: any) => {
      capturedVariantCreates.push(structuredClone(data));
      return { id: smallBoxVariantId, ...data };
    },
    update: async ({ where, data }: any) => {
      capturedVariantUpdates.push({ where: structuredClone(where), data: structuredClone(data) });
      return { id: where.id, ...data };
    },
    delete: async () => ({}),
  },
  variantImage: {
    createMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  },
  productVariantValue: {
    create: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  },
  packagingPreset: {
    findMany: async () => [],
  },
  $transaction: async (fn: (tx: any) => Promise<any>) => fn(dbMock),
};

stub("../auth", { auth: async () => ({ user: { id: "admin-1", role: "ADMIN" } }) });
stub("../lib/db", { db: dbMock });
const { isLargeProduct } = require("../lib/manual-delivery") as typeof import("../lib/manual-delivery");
stub("../lib/redis", {
  CACHE_KEYS: {
    productsAll: "products:all",
    homeTrending: "home:trending",
    categories: "categories",
    product: (slug: string) => `product:${slug}`,
    productBySlug: (slug: string) => `product:${slug}`,
  },
  cacheDel: async () => {},
});
stub("../lib/couriersplease", {
  ...require("../lib/couriersplease"),
  checkCouriersPleaseAvailability: () => ({ available: true, reason: null }),
  getCouriersPleaseRates: async (_address: unknown, groups: any[]) => {
    capturedCourierGroups = groups;
    return [
      {
        serviceCode: "STD",
        serviceName: "Road Express",
        estimatedPrice: 24.5,
        eta: "2-4 business days",
      },
    ];
  },
});
stub("../lib/rate-limit", {
  ...require("../lib/rate-limit"),
  consumeRateLimit: async () => ({ allowed: true, remaining: 10, retryAfter: 60 }),
});
stub("../lib/shipping-quote", {
  createShippingQuoteToken: () => "test-quote-token",
  shippingDestinationKey: () => "test-destination",
});
stub("../lib/manual-delivery", {
  isLargeProduct,
  getManualDeliveryPostcodeRate: async () => manualDeliveryRate,
});

const couriersPleaseRoute = require("../app/api/shipping/couriersplease/route") as typeof import("../app/api/shipping/couriersplease/route");
const adminProductsRoute = require("../app/api/admin/products/route") as typeof import("../app/api/admin/products/route");
const adminProductByIdRoute = require("../app/api/admin/products/[id]/route") as typeof import("../app/api/admin/products/[id]/route");

test("resolveVariantCustomerDimensions displays only variant product dimensions and hides courier dims/weight", () => {
  const full = resolveVariantCustomerDimensions({
    productLength: 210,
    productWidth: 95,
    productHeight: 82,
  });
  assert.deepEqual(full, {
    length: 210,
    width: 95,
    height: 82,
    label: "Product dimensions (L × W × H)",
    formatted: "210 × 95 × 82 cm",
  });

  // Even if courier dimensions/weight exist on the variant object, customer dimensions remain null unless product dims exist
  const courierOnly = resolveVariantCustomerDimensions({
    productLength: null,
    productWidth: null,
    productHeight: null,
    length: 120,
    width: 40,
    height: 20,
    weight: 18,
  } as any);
  assert.equal(courierOnly, null);

  const partial = resolveVariantCustomerDimensions({
    productLength: 180,
    productWidth: null,
    productHeight: 75,
  });
  assert.equal(partial?.formatted, "Length: 180 cm · Height: 75 cm");
});

test("isLargeProduct with withVariantCourierDimensions uses courier parcel dimensions, not customer product dimensions", () => {
  const baseProduct = {
    name: "Modular Bookcase",
    description: "Flat-pack oak shelving",
    isLargeItem: false,
    weight: null,
    length: null,
    width: null,
    height: null,
  };

  // Large assembled customer product dims (220cm tall), compact flat-pack courier box (115x40x18cm, 16kg)
  const flatPackCourier = withVariantCourierDimensions(baseProduct, {
    weight: 16,
    length: 115,
    width: 40,
    height: 18,
    productLength: 220,
    productWidth: 90,
    productHeight: 35,
  } as any);
  assert.equal(isLargeProduct(flatPackCourier), false);

  // Oversize courier variant (>25kg or >180cm parcel) triggers large-item manual delivery even if base product has no weight
  const oversizeParcel = withVariantCourierDimensions(baseProduct, {
    weight: 29,
    length: 140,
    width: 50,
    height: 30,
  });
  assert.equal(isLargeProduct(oversizeParcel), true);
});

test("POST /api/shipping/couriersplease calculates rates strictly from courier parcel dimensions & weight", async () => {
  capturedCourierGroups = [];
  manualDeliveryRate = null;
  mockShippingProducts = [
    {
      id: productId,
      name: "Dining Table",
      description: "Solid ash dining table",
      isLargeItem: false,
      weight: null,
      length: null,
      width: null,
      height: null,
      requiresPackaging: false,
      category: { slug: "tables", name: "Tables" },
      productVariants: [
        {
          id: smallBoxVariantId,
          productLength: 220,
          productWidth: 100,
          productHeight: 76,
          weight: 18.5,
          length: 120,
          width: 45,
          height: 18,
          requiresPackaging: false,
        },
        {
          id: productOnlyVariantId,
          productLength: 160,
          productWidth: 80,
          productHeight: 75,
          weight: null,
          length: null,
          width: null,
          height: null,
          requiresPackaging: false,
        },
        {
          id: heavyParcelVariantId,
          productLength: 140,
          productWidth: 80,
          productHeight: 75,
          weight: 30,
          length: 145,
          width: 85,
          height: 25,
          requiresPackaging: false,
        },
      ],
    },
  ];

  // 1. Flat-pack variant quotes using courier parcel dimensions (120x45x18, 18.5kg), NOT customer 220x100x76
  const quoteReq = new NextRequest("https://shop.example/api/shipping/couriersplease", {
    method: "POST",
    body: JSON.stringify({
      address: {
        name: "Alex Smith",
        line1: "10 Pirie St",
        suburb: "Adelaide",
        state: "SA",
        postcode: "5000",
        country: "AU",
      },
      items: [{ productId, variantId: smallBoxVariantId, quantity: 2 }],
    }),
  });
  const quoteRes = await couriersPleaseRoute.POST(quoteReq);
  assert.equal(quoteRes.status, 200);
  assert.equal(capturedCourierGroups.length, 1);
  assert.equal(capturedCourierGroups[0].weightKg, 18.5);
  assert.equal(capturedCourierGroups[0].lengthCm, 120);
  assert.equal(capturedCourierGroups[0].widthCm, 45);
  assert.equal(capturedCourierGroups[0].heightCm, 18);

  // 2. Variant with ONLY customer product dimensions (missing courier dimensions/weight) must NOT quote with product dims
  const missingCourierReq = new NextRequest("https://shop.example/api/shipping/couriersplease", {
    method: "POST",
    body: JSON.stringify({
      address: {
        name: "Alex Smith",
        line1: "10 Pirie St",
        suburb: "Adelaide",
        state: "SA",
        postcode: "5000",
        country: "AU",
      },
      items: [{ productId, variantId: productOnlyVariantId, quantity: 1 }],
    }),
  });
  const missingCourierRes = await couriersPleaseRoute.POST(missingCourierReq);
  assert.equal(missingCourierRes.status, 422);

  // 3. Variant whose courier weight exceeds 25kg triggers large-item handling even when product length is 140cm
  manualDeliveryRate = { available: true, charge: 49, suburb: "Adelaide" };
  const heavyReq = new NextRequest("https://shop.example/api/shipping/couriersplease", {
    method: "POST",
    body: JSON.stringify({
      address: {
        name: "Alex Smith",
        line1: "10 Pirie St",
        suburb: "Adelaide",
        state: "SA",
        postcode: "5000",
        country: "AU",
      },
      items: [{ productId, variantId: heavyParcelVariantId, quantity: 1 }],
    }),
  });
  const heavyRes = await couriersPleaseRoute.POST(heavyReq);
  assert.equal(heavyRes.status, 200);
  const heavyJson = await heavyRes.json();
  assert.equal(heavyJson.manualDeliveryAvailable, true);
  assert.equal(heavyJson.hasLargeItems, true);
  assert.equal(heavyJson.rates[0].serviceCode, "MANUAL_DELIVERY");
});

test("POST /api/shipping/couriersplease books multi-box extraPackages separately and never bundles multiple products", async () => {
  capturedCourierGroups = [];
  manualDeliveryRate = null;
  const twoBoxProductId = "c523456789012345678901234";
  const singleLampProductId = "c623456789012345678901234";
  mockShippingProducts = [
    {
      id: twoBoxProductId,
      name: "Two-Box Bed Frame",
      description: "Delivered in 2 cartons",
      isLargeItem: false,
      weight: 16,
      length: 100,
      width: 45,
      height: 20,
      extraPackages: [{ weight: 14, length: 80, width: 40, height: 15 }],
      requiresPackaging: false,
      category: { slug: "beds", name: "Beds" },
      productVariants: [],
    },
    {
      id: singleLampProductId,
      name: "Bedside Lamp",
      description: "Table lamp",
      isLargeItem: false,
      weight: 3,
      length: 35,
      width: 25,
      height: 18,
      extraPackages: [],
      requiresPackaging: false,
      category: { slug: "lighting", name: "Lighting" },
      productVariants: [],
    },
  ];

  // Even though 16kg + 14kg = 30kg total, each box is <= 25kg so Couriers Please handles it as 2 separate boxes
  const multiReq = new NextRequest("https://shop.example/api/shipping/couriersplease", {
    method: "POST",
    body: JSON.stringify({
      address: {
        name: "Alex Smith",
        line1: "10 Pirie St",
        suburb: "Adelaide",
        state: "SA",
        postcode: "5000",
        country: "AU",
      },
      items: [
        { productId: twoBoxProductId, quantity: 1 },
        { productId: singleLampProductId, quantity: 2 },
      ],
    }),
  });

  const multiRes = await couriersPleaseRoute.POST(multiReq);
  assert.equal(multiRes.status, 200);
  // 3 distinct parcel groups: Box 1 of bed (x1), Box 2 of bed (x1), Lamp box (x2 separate boxes) -> 4 total cartons
  assert.equal(capturedCourierGroups.length, 3);
  const totalCartons = capturedCourierGroups.reduce((sum, g) => sum + g.count, 0);
  assert.equal(totalCartons, 4);
  assert.ok(capturedCourierGroups.some((g) => g.lengthCm === 100 && g.weightKg === 16 && g.count === 1));
  assert.ok(capturedCourierGroups.some((g) => g.lengthCm === 80 && g.weightKg === 14 && g.count === 1));
  assert.ok(capturedCourierGroups.some((g) => g.lengthCm === 35 && g.weightKg === 3 && g.count === 2));
});

test("Admin product API saves and updates variant product dimensions and extraPackages separately", async () => {
  capturedVariantCreates.length = 0;
  capturedVariantUpdates.length = 0;

  const variantAttrs = [
    {
      id: "attr-temp-1",
      name: "Size",
      displayOrder: 0,
      isPrimary: true,
      values: [{ id: "val-temp-1", value: "Standard", images: [] }],
    },
  ];

  const createReq = new Request("https://shop.example/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Oak Dining Table",
      basePrice: 899,
      sku: "OAK-TBL",
      categoryId: "cat-1",
      hasVariants: true,
      variantAttributes: variantAttrs,
      productVariants: [
        {
          sku: "OAK-TBL-S",
          price: 899,
          stock: 5,
          valueIds: ["val-temp-1"],
          productLength: 210,
          productWidth: 100,
          productHeight: 76,
          weight: 22,
          length: 120,
          width: 45,
          height: 20,
          extraPackages: [{ weight: 14, length: 90, width: 50, height: 20 }],
          requiresPackaging: false,
        },
      ],
    }),
  });

  const createRes = await adminProductsRoute.POST(createReq);
  assert.equal(createRes.status, 201);
  assert.equal(capturedVariantCreates.length, 1);
  assert.equal(capturedVariantCreates[0].productLength, 210);
  assert.equal(capturedVariantCreates[0].productWidth, 100);
  assert.equal(capturedVariantCreates[0].productHeight, 76);
  assert.equal(capturedVariantCreates[0].weight, 22);
  assert.equal(capturedVariantCreates[0].length, 120);
  assert.equal(capturedVariantCreates[0].width, 45);
  assert.equal(capturedVariantCreates[0].height, 20);
  assert.deepEqual(capturedVariantCreates[0].extraPackages, [{ weight: 14, length: 90, width: 50, height: 20 }]);

  const updateReq = new Request(`https://shop.example/api/admin/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Oak Dining Table",
      hasVariants: true,
      variantAttributes: variantAttrs,
      productVariants: [
        {
          id: smallBoxVariantId,
          sku: "OAK-TBL-S",
          price: 899,
          stock: 5,
          valueIds: ["val-temp-1"],
          productLength: null,
          productWidth: null,
          productHeight: null,
          weight: 24,
          length: 125,
          width: 48,
          height: 22,
          extraPackages: [{ weight: 15, length: 95, width: 55, height: 22 }],
          requiresPackaging: true,
        },
      ],
    }),
  });

  const updateRes = await adminProductByIdRoute.PUT(updateReq, {
    params: Promise.resolve({ id: productId }),
  });
  assert.equal(updateRes.status, 200);
  assert.equal(capturedVariantUpdates.length, 1);
  assert.equal(capturedVariantUpdates[0].data.productLength, null);
  assert.equal(capturedVariantUpdates[0].data.productWidth, null);
  assert.equal(capturedVariantUpdates[0].data.productHeight, null);
  assert.equal(capturedVariantUpdates[0].data.weight, 24);
  assert.equal(capturedVariantUpdates[0].data.length, 125);
  assert.equal(capturedVariantUpdates[0].data.width, 48);
  assert.equal(capturedVariantUpdates[0].data.height, 22);
  assert.deepEqual(capturedVariantUpdates[0].data.extraPackages, [{ weight: 15, length: 95, width: 55, height: 22 }]);
});

test("Admin product API saves and updates base product customer product dimensions separately", async () => {
  let createdProductData: any = null;
  let updatedProductData: any = null;

  dbMock.product.create = async ({ data }: any) => {
    createdProductData = structuredClone(data);
    return { id: productId, ...data };
  };
  dbMock.product.update = async ({ data }: any) => {
    updatedProductData = structuredClone(data);
    return { id: productId, ...data };
  };

  const createReq = new Request("https://shop.example/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Simple Solid Wood Desk",
      basePrice: 450,
      sku: "WD-DESK-001",
      categoryId: "cat-1",
      hasVariants: false,
      productLength: 140,
      productWidth: 70,
      productHeight: 75,
      weight: 22,
      length: 148,
      width: 78,
      height: 18,
    }),
  });

  const createRes = await adminProductsRoute.POST(createReq);
  assert.equal(createRes.status, 201);
  assert.equal(createdProductData.productLength, 140);
  assert.equal(createdProductData.productWidth, 70);
  assert.equal(createdProductData.productHeight, 75);
  assert.equal(createdProductData.weight, 22);
  assert.equal(createdProductData.length, 148);

  const updateReq = new Request(`https://shop.example/api/admin/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Simple Solid Wood Desk",
      hasVariants: false,
      productLength: 150,
      productWidth: 75,
      productHeight: 75,
      weight: 24,
      length: 158,
      width: 82,
      height: 20,
    }),
  });

  const updateRes = await adminProductByIdRoute.PUT(updateReq, {
    params: Promise.resolve({ id: productId }),
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updatedProductData.productLength, 150);
  assert.equal(updatedProductData.productWidth, 75);
  assert.equal(updatedProductData.productHeight, 75);
  assert.equal(updatedProductData.weight, 24);
  assert.equal(updatedProductData.length, 158);
});
