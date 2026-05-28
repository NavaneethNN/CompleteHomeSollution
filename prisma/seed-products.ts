import { db } from "@/lib/db";

const furnitureImages = {
  bed: [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?auto=format&fit=crop&w=800&q=80",
  ],
  sofa: [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80",
  ],
  chair: [
    "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=800&q=80",
  ],
  table: [
    "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1601066522407-029b298f3a3b?auto=format&fit=crop&w=800&q=80",
  ],
  dining: [
    "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1604578762246-41134e2295f7?auto=format&fit=crop&w=800&q=80",
  ],
  storage: [
    "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80",
  ],
};

async function main() {
  console.log("🌱 Seeding products...");

  // Get or create categories
  let categories = await db.category.findMany();
  
  if (categories.length === 0) {
    categories = await Promise.all([
      db.category.create({ data: { name: "Living Room", slug: "living-room", image: furnitureImages.sofa[0] } }),
      db.category.create({ data: { name: "Bedroom", slug: "bedroom", image: furnitureImages.bed[0] } }),
      db.category.create({ data: { name: "Dining", slug: "dining", image: furnitureImages.dining[0] } }),
      db.category.create({ data: { name: "Office", slug: "office", image: furnitureImages.chair[0] } }),
      db.category.create({ data: { name: "Storage", slug: "storage", image: furnitureImages.storage[0] } }),
    ]);
  }

  const bedroomCat = categories.find(c => c.slug === "bedroom")!;
  const livingCat = categories.find(c => c.slug === "living-room")!;
  const diningCat = categories.find(c => c.slug === "dining")!;
  const officeCat = categories.find(c => c.slug === "office")!;
  const storageCat = categories.find(c => c.slug === "storage")!;

  // Sample products with variants like the reference image
  const products = [
    {
      name: "King Size Platform Bed",
      slug: "king-size-platform-bed",
      description: "Minimalist platform bed with solid wood slats. No box spring needed. Clean lines for modern bedrooms. Features premium upholstery and sturdy construction for lasting comfort.",
      basePrice: 899,
      comparePrice: 1070,
      memberPrice: 764.15,
      stock: 0,
      sku: "BD-KING-PLATFORM",
      categoryId: bedroomCat.id,
      material: "Solid Pine",
      roomType: "Bedroom",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.bed,
      weight: 45,
      length: 210,
      width: 195,
      height: 35,
      variantAttributes: [
        {
          name: "Model",
          displayOrder: 0,
          values: [
            { value: "Classic", hexCode: null },
            { value: "Modern", hexCode: null },
            { value: "Premium", hexCode: null },
          ],
        },
        {
          name: "Size",
          displayOrder: 1,
          values: [
            { value: "Double", hexCode: null },
            { value: "King", hexCode: null },
            { value: "Queen", hexCode: null },
            { value: "Single", hexCode: null },
          ],
        },
        {
          name: "Color",
          displayOrder: 2,
          values: [
            { value: "Black", hexCode: "#000000" },
            { value: "Oak", hexCode: "#D4A574" },
            { value: "Walnut", hexCode: "#5D4E37" },
            { value: "White", hexCode: "#FFFFFF" },
          ],
        },
      ],
    },
    {
      name: "Luxury Velvet Sofa",
      slug: "luxury-velvet-sofa",
      description: "Experience ultimate comfort with our Luxury Velvet Sofa. Crafted with premium materials, featuring deep cushioning and elegant design perfect for modern living spaces.",
      basePrice: 1299,
      comparePrice: 1599,
      memberPrice: 1104.15,
      stock: 0,
      sku: "SF-VELVET-LUX",
      categoryId: livingCat.id,
      material: "Velvet",
      roomType: "Living Room",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.sofa,
      weight: 65,
      length: 220,
      width: 95,
      height: 85,
      variantAttributes: [
        {
          name: "Color",
          displayOrder: 0,
          values: [
            { value: "Navy Blue", hexCode: "#1B3A5F" },
            { value: "Emerald Green", hexCode: "#046307" },
            { value: "Burgundy", hexCode: "#800020" },
            { value: "Charcoal", hexCode: "#36454F" },
          ],
        },
      ],
    },
    {
      name: "Ergonomic Office Chair",
      slug: "ergonomic-office-chair",
      description: "Professional ergonomic office chair with lumbar support, adjustable height, and breathable mesh back. Perfect for long work sessions.",
      basePrice: 349,
      comparePrice: 499,
      memberPrice: 296.65,
      stock: 45,
      sku: "CH-OFFICE-ERG",
      categoryId: officeCat.id,
      material: "Mesh & Leather",
      roomType: "Office",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.chair,
      weight: 18,
      length: 65,
      width: 65,
      height: 110,
      variantAttributes: [
        {
          name: "Color",
          displayOrder: 0,
          values: [
            { value: "Black", hexCode: "#000000" },
            { value: "Grey", hexCode: "#808080" },
            { value: "White", hexCode: "#FFFFFF" },
          ],
        },
      ],
    },
    {
      name: "Modern Dining Table Set",
      slug: "modern-dining-table-set",
      description: "Contemporary 6-seater dining table with tempered glass top and solid wood legs. Includes matching chairs with cushioned seats.",
      basePrice: 1599,
      comparePrice: 1999,
      memberPrice: 1359.15,
      stock: 12,
      sku: "TB-DINING-MOD",
      categoryId: diningCat.id,
      material: "Glass & Wood",
      roomType: "Dining",
      isActive: true,
      hasVariants: false,
      images: furnitureImages.dining,
      weight: 85,
      length: 180,
      width: 90,
      height: 75,
    },
    {
      name: "Minimalist Coffee Table",
      slug: "minimalist-coffee-table",
      description: "Sleek coffee table with oak wood finish and metal legs. Features a lower shelf for storage and magazines.",
      basePrice: 249,
      comparePrice: 349,
      memberPrice: 211.65,
      stock: 28,
      sku: "TB-COFFEE-MIN",
      categoryId: livingCat.id,
      material: "Oak Wood",
      roomType: "Living Room",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.table,
      weight: 12,
      length: 120,
      width: 60,
      height: 45,
      variantAttributes: [
        {
          name: "Color",
          displayOrder: 0,
          values: [
            { value: "Natural Oak", hexCode: "#D4A574" },
            { value: "Dark Walnut", hexCode: "#5D4E37" },
            { value: "White", hexCode: "#FFFFFF" },
          ],
        },
      ],
    },
    {
      name: "6-Drawer Storage Dresser",
      slug: "6-drawer-storage-dresser",
      description: "Spacious bedroom dresser with 6 smooth-gliding drawers. Solid wood construction with premium metal handles.",
      basePrice: 599,
      comparePrice: 799,
      memberPrice: 509.15,
      stock: 18,
      sku: "ST-DRESSER-6DR",
      categoryId: storageCat.id,
      material: "Solid Wood",
      roomType: "Bedroom",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.storage,
      weight: 55,
      length: 150,
      width: 50,
      height: 80,
      variantAttributes: [
        {
          name: "Color",
          displayOrder: 0,
          values: [
            { value: "White", hexCode: "#FFFFFF" },
            { value: "Espresso", hexCode: "#3C1414" },
            { value: "Grey", hexCode: "#808080" },
          ],
        },
      ],
    },
    {
      name: "Queen Upholstered Bed Frame",
      slug: "queen-upholstered-bed-frame",
      description: "Elegant queen-size bed frame with tufted linen upholstery and sturdy wooden slat support. No box spring required.",
      basePrice: 749,
      comparePrice: 949,
      memberPrice: 636.65,
      stock: 22,
      sku: "BD-QUEEN-UPH",
      categoryId: bedroomCat.id,
      material: "Linen & Wood",
      roomType: "Bedroom",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.bed,
      weight: 40,
      length: 205,
      width: 160,
      height: 110,
      variantAttributes: [
        {
          name: "Color",
          displayOrder: 0,
          values: [
            { value: "Beige", hexCode: "#F5F5DC" },
            { value: "Charcoal", hexCode: "#36454F" },
            { value: "Navy", hexCode: "#000080" },
          ],
        },
      ],
    },
    {
      name: "Leather Recliner Chair",
      slug: "leather-recliner-chair",
      description: "Premium leather recliner with power lift mechanism, massage function, and heated seating. Ultimate relaxation experience.",
      basePrice: 1199,
      comparePrice: 1599,
      memberPrice: 1019.15,
      stock: 8,
      sku: "CH-RECLINER-LEA",
      categoryId: livingCat.id,
      material: "Genuine Leather",
      roomType: "Living Room",
      isActive: true,
      hasVariants: true,
      images: furnitureImages.chair,
      weight: 42,
      length: 90,
      width: 95,
      height: 105,
      variantAttributes: [
        {
          name: "Color",
          displayOrder: 0,
          values: [
            { value: "Black", hexCode: "#000000" },
            { value: "Brown", hexCode: "#8B4513" },
            { value: "Cream", hexCode: "#FFFDD0" },
          ],
        },
      ],
    },
  ];

  for (const productData of products) {
    try {
      const { variantAttributes, ...productInfo } = productData;

      const product = await db.product.create({
        data: {
          ...productInfo,
          hasVariants: productData.hasVariants,
        },
      });

      if (productData.hasVariants && variantAttributes) {
        // Create variant attributes and values
        const valueIdMap = new Map<string, string>();

        for (const attr of variantAttributes) {
          const variantAttr = await db.variantAttribute.create({
            data: {
              name: attr.name,
              displayOrder: attr.displayOrder,
              productId: product.id,
            },
          });

          for (const val of attr.values) {
            const variantValue = await db.variantValue.create({
              data: {
                value: val.value,
                hexCode: val.hexCode,
                variantAttributeId: variantAttr.id,
              },
            });
            valueIdMap.set(`${attr.name}-${val.value}`, variantValue.id);
          }
        }

        // Create product variants - generate all combinations
        if (variantAttributes.length > 0) {
          const generateCombinations = (attrs: typeof variantAttributes, index: number = 0): string[][] => {
            if (index >= attrs.length) return [[]];
            const currentAttr = attrs[index];
            const restCombinations = generateCombinations(attrs, index + 1);
            return currentAttr.values.flatMap(val => 
              restCombinations.map(combo => [
                valueIdMap.get(`${currentAttr.name}-${val.value}`)!,
                ...combo
              ])
            );
          };

          const combinations = generateCombinations(variantAttributes);

          for (let i = 0; i < combinations.length; i++) {
            const valueIds = combinations[i];
            const suffix = valueIds.map(id => {
              for (const attr of variantAttributes) {
                for (const val of attr.values) {
                  if (valueIdMap.get(`${attr.name}-${val.value}`) === id) {
                    return val.value.substring(0, 3).toUpperCase();
                  }
                }
              }
              return "";
            }).join("-");

            const variant = await db.productVariant.create({
              data: {
                productId: product.id,
                sku: `${product.sku}-${suffix}`,
                price: product.basePrice,
                comparePrice: product.comparePrice,
                memberPrice: product.memberPrice,
                stock: 10,
                isActive: true,
                weight: product.weight,
                length: product.length,
                width: product.width,
                height: product.height,
              },
            });

            // Link variant to values
            for (const valueId of valueIds) {
              await db.productVariantValue.create({
                data: {
                  productVariantId: variant.id,
                  variantValueId: valueId,
                },
              });
            }
          }
        }
      }

      console.log(`✅ Created: ${product.name}`);
    } catch (error) {
      console.error(`❌ Failed to create ${productData.name}:`, error);
    }
  }

  console.log("✅ Product seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
