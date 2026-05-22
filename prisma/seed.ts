import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";

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

async function main() {
  console.log("🌱 Seeding database...");

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

  // Create products with variants

  // 1. Luxury Sofa with Color and Size variants
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
      weight: 45,
      length: 220,
      width: 90,
      height: 85,
    },
  });

  // Create variant attributes for sofa
  const sofaColorAttr = await db.variantAttribute.create({
    data: {
      name: "Color",
      displayOrder: 0,
      productId: sofa.id,
    },
  });

  const sofaSizeAttr = await db.variantAttribute.create({
    data: {
      name: "Size",
      displayOrder: 1,
      productId: sofa.id,
    },
  });

  // Create color values
  const black = await db.variantValue.create({
    data: { value: "Midnight Black", hexCode: "#1a1a1a", variantAttributeId: sofaColorAttr.id },
  });
  const navy = await db.variantValue.create({
    data: { value: "Navy Blue", hexCode: "#1e3a5f", variantAttributeId: sofaColorAttr.id },
  });
  const emerald = await db.variantValue.create({
    data: { value: "Emerald Green", hexCode: "#2d5a3d", variantAttributeId: sofaColorAttr.id },
  });
  const burgundy = await db.variantValue.create({
    data: { value: "Burgundy", hexCode: "#722f37", variantAttributeId: sofaColorAttr.id },
  });

  // Create size values
  const twoSeater = await db.variantValue.create({
    data: { value: "2-Seater (180cm)", variantAttributeId: sofaSizeAttr.id },
  });
  const threeSeater = await db.variantValue.create({
    data: { value: "3-Seater (220cm)", variantAttributeId: sofaSizeAttr.id },
  });
  const lShape = await db.variantValue.create({
    data: { value: "L-Shape (280cm x 180cm)", variantAttributeId: sofaSizeAttr.id },
  });

  // Create product variants with specific prices
  const sofaVariants = [
    { sku: "LVS-SOF-BLK-2S", price: 1299, values: [black.id, twoSeater.id],   weight: 38, length: 180, width: 90, height: 85 },
    { sku: "LVS-SOF-BLK-3S", price: 1599, values: [black.id, threeSeater.id], weight: 45, length: 220, width: 90, height: 85 },
    { sku: "LVS-SOF-BLK-LS", price: 2199, values: [black.id, lShape.id],      weight: 68, length: 280, width: 180, height: 85 },
    { sku: "LVS-SOF-NVY-2S", price: 1299, values: [navy.id, twoSeater.id],    weight: 38, length: 180, width: 90, height: 85 },
    { sku: "LVS-SOF-NVY-3S", price: 1599, values: [navy.id, threeSeater.id],  weight: 45, length: 220, width: 90, height: 85 },
    { sku: "LVS-SOF-NVY-LS", price: 2199, values: [navy.id, lShape.id],       weight: 68, length: 280, width: 180, height: 85 },
    { sku: "LVS-SOF-EMR-2S", price: 1399, values: [emerald.id, twoSeater.id], weight: 38, length: 180, width: 90, height: 85 },
    { sku: "LVS-SOF-EMR-3S", price: 1699, values: [emerald.id, threeSeater.id],weight: 45, length: 220, width: 90, height: 85 },
    { sku: "LVS-SOF-EMR-LS", price: 2299, values: [emerald.id, lShape.id],    weight: 68, length: 280, width: 180, height: 85 },
    { sku: "LVS-SOF-BRG-2S", price: 1399, values: [burgundy.id, twoSeater.id],weight: 38, length: 180, width: 90, height: 85 },
    { sku: "LVS-SOF-BRG-3S", price: 1699, values: [burgundy.id, threeSeater.id],weight: 45, length: 220, width: 90, height: 85 },
    { sku: "LVS-SOF-BRG-LS", price: 2299, values: [burgundy.id, lShape.id],   weight: 68, length: 280, width: 180, height: 85 },
  ];

  for (const variant of sofaVariants) {
    const pv = await db.productVariant.create({
      data: {
        sku: variant.sku,
        price: variant.price,
        comparePrice: variant.price * 1.2,
        memberPrice: variant.price * 0.85,
        stock: 15,
        weight: variant.weight,
        length: variant.length,
        width: variant.width,
        height: variant.height,
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

  console.log("✅ Created Luxury Velvet Sofa with 12 variants");

  // 2. Modern Dining Table with Material and Size variants
  const diningTable = await db.product.create({
    data: {
      name: "Modern Extendable Dining Table",
      slug: "modern-extendable-dining-table",
      description:
        "Versatile dining table that extends to accommodate extra guests. Solid construction with premium finishes to suit any dining room decor.",
      basePrice: 0,
      hasVariants: true,
      stock: 30,
      sku: "MDN-TBL-001",
      images: furnitureImages.dining,
      material: "Solid Wood / Tempered Glass",
      roomType: "Dining",
      categoryId: categories[2].id,
      weight: 35,
      length: 160,
      width: 90,
      height: 75,
    },
  });

  const tableMaterialAttr = await db.variantAttribute.create({
    data: { name: "Material", displayOrder: 0, productId: diningTable.id },
  });

  const tableSizeAttr = await db.variantAttribute.create({
    data: { name: "Size", displayOrder: 1, productId: diningTable.id },
  });

  const oak = await db.variantValue.create({
    data: { value: "Oak Wood", variantAttributeId: tableMaterialAttr.id },
  });
  const walnut = await db.variantValue.create({
    data: { value: "Walnut", variantAttributeId: tableMaterialAttr.id },
  });
  const glassTop = await db.variantValue.create({
    data: { value: "Glass Top", variantAttributeId: tableMaterialAttr.id },
  });

  const table4Seat = await db.variantValue.create({
    data: { value: "4-Seater (120cm)", variantAttributeId: tableSizeAttr.id },
  });
  const table6Seat = await db.variantValue.create({
    data: { value: "6-Seater (160cm)", variantAttributeId: tableSizeAttr.id },
  });
  const table8Seat = await db.variantValue.create({
    data: { value: "8-Seater Extendable (200cm)", variantAttributeId: tableSizeAttr.id },
  });

  const tableVariants = [
    { sku: "MDN-TBL-OAK-4S", price: 799,  values: [oak.id, table4Seat.id],      weight: 28, length: 120, width: 80, height: 75 },
    { sku: "MDN-TBL-OAK-6S", price: 999,  values: [oak.id, table6Seat.id],      weight: 35, length: 160, width: 90, height: 75 },
    { sku: "MDN-TBL-OAK-8S", price: 1299, values: [oak.id, table8Seat.id],      weight: 48, length: 200, width: 100, height: 75 },
    { sku: "MDN-TBL-WAL-4S", price: 899,  values: [walnut.id, table4Seat.id],   weight: 30, length: 120, width: 80, height: 75 },
    { sku: "MDN-TBL-WAL-6S", price: 1099, values: [walnut.id, table6Seat.id],   weight: 38, length: 160, width: 90, height: 75 },
    { sku: "MDN-TBL-WAL-8S", price: 1399, values: [walnut.id, table8Seat.id],   weight: 52, length: 200, width: 100, height: 75 },
    { sku: "MDN-TBL-GLS-4S", price: 699,  values: [glassTop.id, table4Seat.id], weight: 32, length: 120, width: 80, height: 75 },
    { sku: "MDN-TBL-GLS-6S", price: 899,  values: [glassTop.id, table6Seat.id], weight: 40, length: 160, width: 90, height: 75 },
  ];

  for (const variant of tableVariants) {
    const pv = await db.productVariant.create({
      data: {
        sku: variant.sku,
        price: variant.price,
        comparePrice: variant.price * 1.15,
        memberPrice: variant.price * 0.9,
        stock: 10,
        weight: variant.weight,
        length: variant.length,
        width: variant.width,
        height: variant.height,
        productId: diningTable.id,
        values: {
          create: variant.values.map((vid) => ({ variantValueId: vid })),
        },
      },
    });

    await db.variantImage.createMany({
      data: furnitureImages.dining.map((url, idx) => ({
        url,
        displayOrder: idx,
        productVariantId: pv.id,
      })),
    });
  }

  console.log("✅ Created Modern Dining Table with 8 variants");

  // 3. Simple products without variants
  const simpleProducts = [
    {
      name: "Ergonomic Office Chair",
      slug: "ergonomic-office-chair",
      description: "Premium ergonomic office chair with lumbar support, adjustable armrests, and breathable mesh back.",
      basePrice: 449, comparePrice: 549, memberPrice: 399, stock: 25,
      sku: "OF-CHR-001", images: furnitureImages.chair,
      material: "Mesh, Aluminum", roomType: "Office", categoryId: categories[3].id,
      weight: 14, length: 68, width: 68, height: 120,
    },
    {
      name: "King Size Platform Bed",
      slug: "king-size-platform-bed",
      description: "Minimalist platform bed with solid wood slats. No box spring needed. Clean lines for modern bedrooms.",
      basePrice: 899, comparePrice: 1099, memberPrice: 799, stock: 20,
      sku: "BD-KNG-001", images: furnitureImages.bed,
      material: "Solid Pine", roomType: "Bedroom", categoryId: categories[1].id,
      weight: 62, length: 215, width: 195, height: 40,
    },
    {
      name: "Scandinavian Coffee Table",
      slug: "scandinavian-coffee-table",
      description: "Minimalist coffee table with clean lines and tapered legs. Perfect centerpiece for your living room.",
      basePrice: 299, comparePrice: 379, memberPrice: 269, stock: 40,
      sku: "LV-TBL-001", images: furnitureImages.table,
      material: "Oak Veneer", roomType: "Living Room", categoryId: categories[0].id,
      weight: 18, length: 110, width: 60, height: 45,
    },
    {
      name: "Modular Wardrobe System",
      slug: "modular-wardrobe-system",
      description: "Customizable wardrobe system with adjustable shelves, hanging rods, and drawers. Build your perfect storage.",
      basePrice: 599, comparePrice: 749, memberPrice: 539, stock: 15,
      sku: "ST-WDR-001", images: furnitureImages.storage,
      material: "Melamine Coated Particle Board", roomType: "Bedroom", categoryId: categories[4].id,
      weight: 55, length: 150, width: 60, height: 200,
    },
    {
      name: "Executive Desk",
      slug: "executive-desk",
      description: "Spacious executive desk with built-in cable management and storage drawers. Professional workspace solution.",
      basePrice: 699, comparePrice: 849, memberPrice: 629, stock: 18,
      sku: "OF-DSK-001", images: furnitureImages.table,
      material: "Engineered Wood", roomType: "Office", categoryId: categories[3].id,
      weight: 42, length: 160, width: 75, height: 76,
    },
    {
      name: "Curved Accent Chair",
      slug: "curved-accent-chair",
      description: "Soft upholstered accent chair with a sculpted silhouette, ideal for reading corners and lounge spaces.",
      basePrice: 379, comparePrice: 459, memberPrice: 339, stock: 22,
      sku: "LV-CHR-002", images: furnitureImages.chair,
      material: "Boucle Fabric", roomType: "Living Room", categoryId: categories[0].id,
      weight: 16, length: 75, width: 72, height: 88,
    },
    {
      name: "Floating Nightstand",
      slug: "floating-nightstand",
      description: "Wall-mounted nightstand with a slim drawer and open shelf for a compact, modern bedside setup.",
      basePrice: 189, comparePrice: 239, memberPrice: 169, stock: 35,
      sku: "BD-NTS-002", images: furnitureImages.storage,
      material: "Oak Veneer", roomType: "Bedroom", categoryId: categories[1].id,
      weight: 8, length: 45, width: 30, height: 35,
    },
    {
      name: "Six-Seater Dining Set",
      slug: "six-seater-dining-set",
      description: "Complete dining set with a rectangular table and matching chairs for everyday family meals and hosting.",
      basePrice: 1499, comparePrice: 1799, memberPrice: 1349, stock: 8,
      sku: "DN-SET-002", images: furnitureImages.dining,
      material: "Solid Ash", roomType: "Dining Room", categoryId: categories[2].id,
      weight: 95, length: 180, width: 90, height: 76,
    },
    {
      name: "Open Bookshelf",
      slug: "open-bookshelf",
      description: "Tall open shelving unit with five adjustable shelves for books, decor, and storage baskets.",
      basePrice: 429, comparePrice: 519, memberPrice: 389, stock: 16,
      sku: "ST-SHF-002", images: furnitureImages.storage,
      material: "Laminate MDF", roomType: "Office", categoryId: categories[4].id,
      weight: 30, length: 80, width: 30, height: 180,
    },
    {
      name: "Entry Console Table",
      slug: "entry-console-table",
      description: "Slim console table designed for hallways and entryways with a drawer and lower shelf for essentials.",
      basePrice: 269, comparePrice: 329, memberPrice: 239, stock: 28,
      sku: "LV-CNS-002", images: furnitureImages.table,
      material: "Walnut Veneer", roomType: "Living Room", categoryId: categories[0].id,
      weight: 12, length: 120, width: 35, height: 80,
    },
  ];

  for (const product of simpleProducts) {
    await db.product.create({
      data: product,
    });
  }

  console.log(`✅ Created ${simpleProducts.length} simple products`);

  // 4. Bedroom Set with multiple attributes
  const bedroomSet = await db.product.create({
    data: {
      name: "Complete Bedroom Set",
      slug: "complete-bedroom-set",
      description:
        "Transform your bedroom with this complete set including bed frame, nightstands, and dresser. Multiple finish options available.",
      basePrice: 0,
      hasVariants: true,
      stock: 20,
      sku: "BD-SET-001",
      images: furnitureImages.bed,
      material: "Solid Wood",
      roomType: "Bedroom",
      categoryId: categories[1].id,
      weight: 85,
      length: 215,
      width: 160,
      height: 120,
    },
  });

  const bedSizeAttr = await db.variantAttribute.create({
    data: { name: "Bed Size", displayOrder: 0, productId: bedroomSet.id },
  });

  const bedFinishAttr = await db.variantAttribute.create({
    data: { name: "Finish", displayOrder: 1, productId: bedroomSet.id },
  });

  const queen = await db.variantValue.create({
    data: { value: "Queen", variantAttributeId: bedSizeAttr.id },
  });
  const king = await db.variantValue.create({
    data: { value: "King", variantAttributeId: bedSizeAttr.id },
  });

  const whiteFinish = await db.variantValue.create({
    data: { value: "White", hexCode: "#f5f5f5", variantAttributeId: bedFinishAttr.id },
  });
  const espresso = await db.variantValue.create({
    data: { value: "Espresso", hexCode: "#3d2817", variantAttributeId: bedFinishAttr.id },
  });
  const greyFinish = await db.variantValue.create({
    data: { value: "Grey", hexCode: "#6b7280", variantAttributeId: bedFinishAttr.id },
  });

  const bedVariants = [
    { sku: "BD-SET-WHT-QN", price: 1299, values: [queen.id, whiteFinish.id], weight: 75, length: 205, width: 158, height: 120 },
    { sku: "BD-SET-WHT-KG", price: 1499, values: [king.id, whiteFinish.id],  weight: 85, length: 215, width: 196, height: 120 },
    { sku: "BD-SET-ESP-QN", price: 1299, values: [queen.id, espresso.id],    weight: 75, length: 205, width: 158, height: 120 },
    { sku: "BD-SET-ESP-KG", price: 1499, values: [king.id, espresso.id],     weight: 85, length: 215, width: 196, height: 120 },
    { sku: "BD-SET-GRY-QN", price: 1399, values: [queen.id, greyFinish.id],  weight: 75, length: 205, width: 158, height: 120 },
    { sku: "BD-SET-GRY-KG", price: 1599, values: [king.id, greyFinish.id],   weight: 85, length: 215, width: 196, height: 120 },
  ];

  for (const variant of bedVariants) {
    const pv = await db.productVariant.create({
      data: {
        sku: variant.sku,
        price: variant.price,
        comparePrice: variant.price * 1.25,
        memberPrice: variant.price * 0.88,
        stock: 8,
        weight: variant.weight,
        length: variant.length,
        width: variant.width,
        height: variant.height,
        productId: bedroomSet.id,
        values: {
          create: variant.values.map((vid) => ({ variantValueId: vid })),
        },
      },
    });

    await db.variantImage.createMany({
      data: furnitureImages.bed.map((url, idx) => ({
        url,
        displayOrder: idx,
        productVariantId: pv.id,
      })),
    });
  }

  console.log("✅ Created Complete Bedroom Set with 6 variants");

  console.log("\n🎉 Database seeded successfully!");
  console.log(`📊 Summary:`);
  console.log(`   - ${categories.length} Categories`);
  console.log(`   - 8 Products (4 with variants, 4 simple)`);
  console.log(`   - 26 Product Variants`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
