const { config } = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

// Load env vars
config({ path: ".env.local" });

// Diverse image collections for different variants
const furnitureImages = {
  // Sofa images by color
  sofa: {
    black: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=800&q=80",
    ],
    blue: [
      "https://images.unsplash.com/photo-1550226894-d7786be3bd3b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1540574163026-643ea20ade25?auto=format&fit=crop&w=800&q=80",
    ],
    green: [
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=800&q=80",
    ],
    grey: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
    ],
  },
  // Chair images by model/color
  chair: {
    standard: {
      black: [
        "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617103996709-44d15585d096?auto=format&fit=crop&w=800&q=80",
      ],
      blue: [
        "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
      ],
    },
    pro: {
      black: [
        "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1617103996709-44d15585d096?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
      ],
      blue: [
        "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
      ],
    },
    executive: {
      black: [
        "https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617103996709-44d15585d096?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80",
      ],
      blue: [
        "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  // Bed images by size/color
  bed: {
    single: {
      oak: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
      ],
      walnut: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
      ],
    },
    double: {
      oak: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
      walnut: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
    },
    queen: {
      oak: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
      ],
      walnut: [
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
      ],
    },
    king: {
      oak: [
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
      walnut: [
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  // Table images by model/color
  table: {
    basic: {
      natural: [
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
      ],
      dark: [
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
      ],
    },
    premium: {
      natural: [
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
      ],
      dark: [
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
      ],
    },
    deluxe: {
      natural: [
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
      ],
      dark: [
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
      ],
      white: [
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
      ],
      black: [
        "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
  // Wardrobe images by size/color
  storage: {
    door2: {
      white: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
      beige: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
      oak: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
    },
    door3: {
      white: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
      beige: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
      oak: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
    },
    door4: {
      white: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
      beige: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
      oak: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
    },
    door5: {
      white: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
      beige: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
      grey: [
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
      ],
      oak: [
        "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
      ],
    },
  },
};

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter, log: ["error"] });
}

const db = createPrismaClient();

async function main() {
  console.log("🌱 Seeding database...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✓ Set" : "✗ Missing");

  // Clear existing data
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.review.deleteMany();
  await db.productVariantValue.deleteMany();
  await db.variantImage.deleteMany();
  await db.productVariant.deleteMany();
  await db.variantValue.deleteMany();
  await db.variantAttribute.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();

  // Create categories
  const categories = await Promise.all([
    db.category.create({
      data: {
        name: "Living Room",
        slug: "living-room",
        image: furnitureImages.sofa.black[0],
      },
    }),
    db.category.create({
      data: {
        name: "Bedroom",
        slug: "bedroom",
        image: furnitureImages.bed.queen.oak[0],
      },
    }),
    db.category.create({
      data: {
        name: "Dining",
        slug: "dining",
        image: furnitureImages.table.basic.natural[0],
      },
    }),
    db.category.create({
      data: {
        name: "Office",
        slug: "office",
        image: furnitureImages.chair.standard.black[0],
      },
    }),
    db.category.create({
      data: {
        name: "Storage",
        slug: "storage",
        image: furnitureImages.storage.door3.white[0],
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Create Luxury Sofa with variants - using color-specific images
  const sofa = await db.product.create({
    data: {
      name: "Luxury Velvet Sofa",
      slug: "luxury-velvet-sofa",
      description:
        "Experience ultimate comfort with our Luxury Velvet Sofa. Crafted with premium materials, featuring deep cushioning and elegant design perfect for modern living spaces.",
      basePrice: 0,
      hasVariants: true,
      stock: 50,
      sku: "LVS-SOF-001",
      images: furnitureImages.sofa.black,
      material: "Velvet, Hardwood Frame",
      roomType: "Living Room",
      categoryId: categories[0].id,
    },
  });

  const sofaColorAttr = await db.variantAttribute.create({
    data: { name: "Color", displayOrder: 0, productId: sofa.id },
  });

  const sofaSizeAttr = await db.variantAttribute.create({
    data: { name: "Size", displayOrder: 1, productId: sofa.id },
  });

  const black = await db.variantValue.create({
    data: { value: "Midnight Black", hexCode: "#1a1a1a", variantAttributeId: sofaColorAttr.id },
  });
  const navy = await db.variantValue.create({
    data: { value: "Navy Blue", hexCode: "#1e3a5f", variantAttributeId: sofaColorAttr.id },
  });
  const emerald = await db.variantValue.create({
    data: { value: "Emerald Green", hexCode: "#2d5a3d", variantAttributeId: sofaColorAttr.id },
  });

  const twoSeater = await db.variantValue.create({
    data: { value: "2-Seater (180cm)", variantAttributeId: sofaSizeAttr.id },
  });
  const threeSeater = await db.variantValue.create({
    data: { value: "3-Seater (220cm)", variantAttributeId: sofaSizeAttr.id },
  });

  // Map variant combinations to color-specific images
  const sofaVariantConfigs = [
    { sku: "LVS-SOF-BLK-2S", price: 1299, values: [black.id, twoSeater.id], colorKey: "black" },
    { sku: "LVS-SOF-BLK-3S", price: 1599, values: [black.id, threeSeater.id], colorKey: "black" },
    { sku: "LVS-SOF-NVY-2S", price: 1299, values: [navy.id, twoSeater.id], colorKey: "blue" },
    { sku: "LVS-SOF-NVY-3S", price: 1599, values: [navy.id, threeSeater.id], colorKey: "blue" },
    { sku: "LVS-SOF-EMR-2S", price: 1399, values: [emerald.id, twoSeater.id], colorKey: "green" },
    { sku: "LVS-SOF-EMR-3S", price: 1699, values: [emerald.id, threeSeater.id], colorKey: "green" },
  ];

  for (const variant of sofaVariantConfigs) {
    const pv = await db.productVariant.create({
      data: {
        sku: variant.sku,
        price: variant.price,
        comparePrice: variant.price * 1.2,
        memberPrice: variant.price * 0.85,
        stock: 15,
        productId: sofa.id,
        values: {
          create: variant.values.map((vid) => ({ variantValueId: vid })),
        },
      },
    });

    // Use color-specific images
    const colorImages = furnitureImages.sofa[variant.colorKey] || furnitureImages.sofa.black;
    await db.variantImage.createMany({
      data: colorImages.map((url, idx) => ({
        url,
        displayOrder: idx,
        productVariantId: pv.id,
      })),
    });
  }

  console.log("✅ Created Luxury Velvet Sofa with 6 variants (color-specific images)");

  // Helper function to create product with Model, Size, Color variants
  // getImagesForVariant: function that receives (model, size, color) and returns image array
  async function createProductWithVariants(productData, getImagesForVariant, variantConfig) {
    const product = await db.product.create({
      data: {
        ...productData,
        basePrice: 0,
        hasVariants: true,
      },
    });

    // Create Model attribute
    const modelAttr = await db.variantAttribute.create({
      data: { name: "Model", displayOrder: 0, productId: product.id },
    });

    // Create Size attribute
    const sizeAttr = await db.variantAttribute.create({
      data: { name: "Size", displayOrder: 1, productId: product.id },
    });

    // Create Color attribute
    const colorAttr = await db.variantAttribute.create({
      data: { name: "Color", displayOrder: 2, productId: product.id },
    });

    // Create variant values
    const models = [];
    for (const model of variantConfig.models) {
      models.push(await db.variantValue.create({
        data: { value: model, variantAttributeId: modelAttr.id },
      }));
    }

    const sizes = [];
    for (const size of variantConfig.sizes) {
      sizes.push(await db.variantValue.create({
        data: { value: size.name, variantAttributeId: sizeAttr.id },
      }));
    }

    const colors = [];
    for (const color of variantConfig.colors) {
      colors.push(await db.variantValue.create({
        data: { value: color.name, hexCode: color.hex, variantAttributeId: colorAttr.id },
      }));
    }

    // Create all combinations with variant-specific images
    let variantCount = 0;
    for (const model of models) {
      for (const size of sizes) {
        for (const color of colors) {
          const basePrice = variantConfig.basePrice + (size.priceMod || 0) + (color.priceMod || 0);
          const pv = await db.productVariant.create({
            data: {
              sku: `${productData.sku}-${model.value.slice(0,3).toUpperCase()}-${size.value.slice(0,2).toUpperCase()}-${color.value.slice(0,3).toUpperCase()}`,
              price: basePrice,
              comparePrice: basePrice * 1.2,
              memberPrice: basePrice * 0.85,
              stock: 10 + Math.floor(Math.random() * 20),
              productId: product.id,
              values: {
                create: [
                  { variantValueId: model.id },
                  { variantValueId: size.id },
                  { variantValueId: color.id },
                ],
              },
            },
          });

          // Get variant-specific images
          const variantImages = getImagesForVariant(model.value, size.value, color.value);
          await db.variantImage.createMany({
            data: variantImages.map((url, idx) => ({
              url,
              displayOrder: idx,
              productVariantId: pv.id,
            })),
          });
          variantCount++;
        }
      }
    }

    console.log(`✅ Created ${productData.name} with ${variantCount} variants`);
    return product;
  }

  // 2. Ergonomic Office Chair with Model, Size, Color variants
  await createProductWithVariants(
    {
      name: "Ergonomic Office Chair",
      slug: "ergonomic-office-chair",
      description: "Premium ergonomic office chair with lumbar support, adjustable armrests, and breathable mesh back.",
      sku: "OF-CHR",
      images: furnitureImages.chair.standard.black, // default images
      material: "Mesh, Aluminum",
      roomType: "Office",
      categoryId: categories[3].id,
    },
    // Image getter function - returns different images based on model and color
    (model, size, color) => {
      const modelKey = model.toLowerCase();
      const colorKey = color.toLowerCase();
      return furnitureImages.chair[modelKey]?.[colorKey] || furnitureImages.chair.standard.black;
    },
    {
      basePrice: 449,
      models: ["Standard", "Pro", "Executive"],
      sizes: [
        { name: "Small", priceMod: -50 },
        { name: "Medium", priceMod: 0 },
        { name: "Large", priceMod: 50 },
      ],
      colors: [
        { name: "Black", hex: "#1a1a1a", priceMod: 0 },
        { name: "Grey", hex: "#6b7280", priceMod: 0 },
        { name: "White", hex: "#f5f5f5", priceMod: 20 },
        { name: "Blue", hex: "#1e3a5f", priceMod: 30 },
      ],
    }
  );

  // 3. King Size Platform Bed with Model, Size, Color variants
  await createProductWithVariants(
    {
      name: "King Size Platform Bed",
      slug: "king-size-platform-bed",
      description: "Minimalist platform bed with solid wood slats. No box spring needed. Clean lines for modern bedrooms.",
      sku: "BD-KNG",
      images: furnitureImages.bed.queen.oak, // default images
      material: "Solid Pine",
      roomType: "Bedroom",
      categoryId: categories[1].id,
    },
    // Image getter function - returns different images based on size and color
    (model, size, color) => {
      const sizeKey = size.toLowerCase().replace(/\s+/g, '');
      const colorKey = color.toLowerCase();
      return furnitureImages.bed[sizeKey]?.[colorKey] || furnitureImages.bed.queen.oak;
    },
    {
      basePrice: 899,
      models: ["Classic", "Modern", "Premium"],
      sizes: [
        { name: "Single", priceMod: -300 },
        { name: "Double", priceMod: -100 },
        { name: "Queen", priceMod: 0 },
        { name: "King", priceMod: 200 },
      ],
      colors: [
        { name: "Oak", hex: "#c4a77d", priceMod: 0 },
        { name: "Walnut", hex: "#5d4a3a", priceMod: 50 },
        { name: "White", hex: "#f5f5f5", priceMod: 30 },
        { name: "Black", hex: "#1a1a1a", priceMod: 30 },
      ],
    }
  );

  // 4. Scandinavian Coffee Table with Model, Size, Color variants
  await createProductWithVariants(
    {
      name: "Scandinavian Coffee Table",
      slug: "scandinavian-coffee-table",
      description: "Minimalist coffee table with clean lines and tapered legs. Perfect centerpiece for your living room.",
      sku: "LV-TBL",
      images: furnitureImages.table.basic.natural, // default images
      material: "Oak Veneer",
      roomType: "Living Room",
      categoryId: categories[0].id,
    },
    // Image getter function - returns different images based on model and color
    (model, size, color) => {
      const modelKey = model.toLowerCase();
      const colorKey = color.toLowerCase().replace(/\s+/g, '');
      return furnitureImages.table[modelKey]?.[colorKey] || furnitureImages.table.basic.natural;
    },
    {
      basePrice: 299,
      models: ["Basic", "Premium", "Deluxe"],
      sizes: [
        { name: "Small (80cm)", priceMod: -50 },
        { name: "Medium (100cm)", priceMod: 0 },
        { name: "Large (120cm)", priceMod: 80 },
      ],
      colors: [
        { name: "Natural", hex: "#d4c4a8", priceMod: 0 },
        { name: "Dark Oak", hex: "#5c4a3d", priceMod: 30 },
        { name: "White", hex: "#f5f5f5", priceMod: 20 },
        { name: "Black", hex: "#1a1a1a", priceMod: 20 },
      ],
    }
  );

  // 5. Modular Wardrobe System with Model, Size, Color variants
  await createProductWithVariants(
    {
      name: "Modular Wardrobe System",
      slug: "modular-wardrobe-system",
      description: "Customizable wardrobe system with adjustable shelves, hanging rods, and drawers.",
      sku: "ST-WDR",
      images: furnitureImages.storage.door3.white, // default images
      material: "Melamine Coated Particle Board",
      roomType: "Bedroom",
      categoryId: categories[4].id,
    },
    // Image getter function - returns different images based on size (door count) and color
    (model, size, color) => {
      const sizeKey = size.toLowerCase().replace(/\s+/g, '').replace('-', '');
      const colorKey = color.toLowerCase();
      return furnitureImages.storage[sizeKey]?.[colorKey] || furnitureImages.storage.door3.white;
    },
    {
      basePrice: 599,
      models: ["Basic", "Standard", "Premium"],
      sizes: [
        { name: "2-Door", priceMod: -200 },
        { name: "3-Door", priceMod: 0 },
        { name: "4-Door", priceMod: 250 },
        { name: "5-Door", priceMod: 450 },
      ],
      colors: [
        { name: "White", hex: "#f5f5f5", priceMod: 0 },
        { name: "Beige", hex: "#e8dcc4", priceMod: 0 },
        { name: "Grey", hex: "#6b7280", priceMod: 30 },
        { name: "Oak", hex: "#c4a77d", priceMod: 50 },
      ],
    }
  );

  // Count total variants created
  const totalVariants = await db.productVariant.count();

  console.log("\n🎉 Database seeded successfully!");
  console.log(`📊 Summary:`);
  console.log(`   - ${categories.length} Categories`);
  console.log(`   - 5 Products (all with variants)`);
  console.log(`   - ${totalVariants} Total Product Variants`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
