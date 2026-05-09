const { config } = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");

// Load env vars
config({ path: ".env.local" });

const furnitureImages = {
  sofa: [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80",
  ],
  bed: [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
  ],
  dining: [
    "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1604578762246-41134e2295f7?auto=format&fit=crop&w=800&q=80",
  ],
  chair: [
    "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
  ],
  table: [
    "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
  ],
  storage: [
    "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
  ],
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
        image: furnitureImages.sofa[0],
      },
    }),
    db.category.create({
      data: {
        name: "Bedroom",
        slug: "bedroom",
        image: furnitureImages.bed[0],
      },
    }),
    db.category.create({
      data: {
        name: "Dining",
        slug: "dining",
        image: furnitureImages.dining[0],
      },
    }),
    db.category.create({
      data: {
        name: "Office",
        slug: "office",
        image: furnitureImages.chair[0],
      },
    }),
    db.category.create({
      data: {
        name: "Storage",
        slug: "storage",
        image: furnitureImages.storage[0],
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Create Luxury Sofa with variants
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
      images: furnitureImages.sofa,
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

  const sofaVariants = [
    { sku: "LVS-SOF-BLK-2S", price: 1299, values: [black.id, twoSeater.id] },
    { sku: "LVS-SOF-BLK-3S", price: 1599, values: [black.id, threeSeater.id] },
    { sku: "LVS-SOF-NVY-2S", price: 1299, values: [navy.id, twoSeater.id] },
    { sku: "LVS-SOF-NVY-3S", price: 1599, values: [navy.id, threeSeater.id] },
    { sku: "LVS-SOF-EMR-2S", price: 1399, values: [emerald.id, twoSeater.id] },
    { sku: "LVS-SOF-EMR-3S", price: 1699, values: [emerald.id, threeSeater.id] },
  ];

  for (const variant of sofaVariants) {
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

    await db.variantImage.createMany({
      data: furnitureImages.sofa.map((url, idx) => ({
        url,
        displayOrder: idx,
        productVariantId: pv.id,
      })),
    });
  }

  console.log("✅ Created Luxury Velvet Sofa with 6 variants");

  // Create simple products without variants
  const simpleProducts = [
    {
      name: "Ergonomic Office Chair",
      slug: "ergonomic-office-chair",
      description: "Premium ergonomic office chair with lumbar support, adjustable armrests, and breathable mesh back.",
      basePrice: 449,
      comparePrice: 549,
      memberPrice: 399,
      stock: 25,
      sku: "OF-CHR-001",
      images: furnitureImages.chair,
      material: "Mesh, Aluminum",
      roomType: "Office",
      categoryId: categories[3].id,
    },
    {
      name: "King Size Platform Bed",
      slug: "king-size-platform-bed",
      description: "Minimalist platform bed with solid wood slats. No box spring needed. Clean lines for modern bedrooms.",
      basePrice: 899,
      comparePrice: 1099,
      memberPrice: 799,
      stock: 20,
      sku: "BD-KNG-001",
      images: furnitureImages.bed,
      material: "Solid Pine",
      roomType: "Bedroom",
      categoryId: categories[1].id,
    },
    {
      name: "Scandinavian Coffee Table",
      slug: "scandinavian-coffee-table",
      description: "Minimalist coffee table with clean lines and tapered legs. Perfect centerpiece for your living room.",
      basePrice: 299,
      comparePrice: 379,
      memberPrice: 269,
      stock: 40,
      sku: "LV-TBL-001",
      images: furnitureImages.table,
      material: "Oak Veneer",
      roomType: "Living Room",
      categoryId: categories[0].id,
    },
    {
      name: "Modular Wardrobe System",
      slug: "modular-wardrobe-system",
      description: "Customizable wardrobe system with adjustable shelves, hanging rods, and drawers.",
      basePrice: 599,
      comparePrice: 749,
      memberPrice: 539,
      stock: 15,
      sku: "ST-WDR-001",
      images: furnitureImages.storage,
      material: "Melamine Coated Particle Board",
      roomType: "Bedroom",
      categoryId: categories[4].id,
    },
  ];

  for (const product of simpleProducts) {
    await db.product.create({ data: product });
  }

  console.log(`✅ Created ${simpleProducts.length} simple products`);

  console.log("\n🎉 Database seeded successfully!");
  console.log(`📊 Summary:`);
  console.log(`   - ${categories.length} Categories`);
  console.log(`   - 5 Products (1 with variants, 4 simple)`);
  console.log(`   - 6 Product Variants`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
