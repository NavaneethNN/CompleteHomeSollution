import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import slugify from "slugify";

// Validation schemas
const variantValueSchema = z.object({
  id: z.string(), // temp ID from frontend
  value: z.string(),
  hexCode: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
});

const variantAttributeSchema = z.object({
  id: z.string(), // temp ID from frontend
  name: z.string(),
  displayOrder: z.number().default(0),
  isPrimary: z.boolean().default(false),
  values: z.array(variantValueSchema),
});

const productVariantSchema = z.object({
  sku: z.string().min(1),
  price: z.number().nonnegative(),
  comparePrice: z.number().optional().nullable(),
  memberPrice: z.number().optional().nullable(),
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  valueIds: z.array(z.string()), // Array of variant value IDs
  images: z.array(z.string()).optional(),
  weight: z.number().optional().nullable(),
  length: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
});

// Security constants
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_IMAGES_COUNT = 10;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SKU_LENGTH = 50;

// Custom validation for image size (handles both base64 and URLs)
const validateImageSize = (imageString: string): boolean => {
  // If it's a URL (starts with http), skip size validation
  // (images are already uploaded to R2 and size-checked during upload)
  if (imageString.startsWith('http://') || imageString.startsWith('https://')) {
    return true;
  }
  
  // Handle base64 images (legacy support)
  if (imageString.startsWith('data:image/')) {
    const base64 = imageString.replace(/^data:image\/\w+;base64,/, '');
    const sizeInBytes = (base64.length * 3) / 4;
    return sizeInBytes <= MAX_IMAGE_SIZE_BYTES;
  }
  
  // Unknown format, reject
  return false;
};

const createProductSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().nullable(),
  basePrice: z.number().nonnegative(),
  comparePrice: z.number().optional().nullable(),
  memberPrice: z.number().optional().nullable(),
  stock: z.number().int().min(0).default(0),
  sku: z.string().min(1).max(MAX_SKU_LENGTH),
  categoryId: z.string(),
  material: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
  images: z.array(z.string())
    .max(MAX_IMAGES_COUNT, `Maximum ${MAX_IMAGES_COUNT} images allowed`)
    .refine(
      (images) => images.every(img => validateImageSize(img)),
      `Each image must be under ${MAX_IMAGE_SIZE_MB}MB or a valid URL`
    )
    .default([]),
  weight: z.number().optional().nullable(),
  length: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  // For products with variants
  variantAttributes: z.array(variantAttributeSchema).optional(),
  productVariants: z.array(productVariantSchema).optional(),
});

// GET /api/admin/products - List all products with pagination
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";

  const skip = (page - 1) * limit;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.categoryId = category;
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { name: true, slug: true } },
          productVariants: {
            select: {
              stock: true,
            },
          },
          _count: {
            select: {
              productVariants: true,
            },
          },
        },
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/products]", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST /api/admin/products - Create a new product
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createProductSchema.parse(body);

    // Generate slug from name
    const baseSlug = slugify(data.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await db.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create product in a transaction
    const product = await db.$transaction(async (tx) => {
      console.log("[POST /api/admin/products] Creating base product...");
      // 1. Create the base product
      const newProduct = await tx.product.create({
        data: {
          name: data.name,
          slug,
          description: data.description || "",
          basePrice: data.basePrice,
          comparePrice: data.comparePrice,
          memberPrice: data.memberPrice,
          stock: data.stock,
          sku: data.sku,
          categoryId: data.categoryId,
          material: data.material,
          roomType: data.roomType,
          isActive: data.isActive,
          hasVariants: data.hasVariants,
          images: data.images,
          weight: data.weight,
          length: data.length,
          width: data.width,
          height: data.height,
        },
      });

      // 2. If product has variants, create variant attributes and values
      if (data.hasVariants && data.variantAttributes && data.variantAttributes.length > 0) {
        console.log("[POST /api/admin/products] Creating variants, attributes:", data.variantAttributes.length);
        // Build maps: temp ID -> DB ID
        const attrTempIdToDbId = new Map<string, string>();
        const valueTempIdToDbId = new Map<string, string>();

        // Create variant attributes and their values
        for (const attr of data.variantAttributes) {
          console.log("[POST /api/admin/products] Creating attribute:", attr.name, "tempId:", attr.id);
          const variantAttr = await tx.variantAttribute.create({
            data: {
              name: attr.name,
              displayOrder: attr.displayOrder,
              isPrimary: attr.isPrimary ?? false,
              productId: newProduct.id,
            },
          });
          // Map temp attr ID to DB ID
          attrTempIdToDbId.set(attr.id, variantAttr.id);

          // Create variant values and build temp ID to DB ID mapping
          for (const val of attr.values) {
            const variantValue = await tx.variantValue.create({
              data: {
                value: val.value,
                hexCode: val.hexCode,
                images: val.images ?? [],
                variantAttributeId: variantAttr.id,
              },
            });
            // Map temp value ID to DB ID
            valueTempIdToDbId.set(val.id, variantValue.id);
          }
        }

        // 3. Create product variants
        if (data.productVariants && data.productVariants.length > 0) {
          console.log("[POST /api/admin/products] Creating product variants:", data.productVariants.length);
          console.log("[POST /api/admin/products] Value ID mapping:", Object.fromEntries(valueTempIdToDbId));
          for (const variant of data.productVariants) {
            console.log("[POST /api/admin/products] Creating variant with valueIds:", variant.valueIds);
            const newVariant = await tx.productVariant.create({
              data: {
                productId: newProduct.id,
                sku: variant.sku,
                price: variant.price,
                comparePrice: variant.comparePrice,
                memberPrice: variant.memberPrice,
                stock: variant.stock,
                isActive: variant.isActive,
                weight: variant.weight,
                length: variant.length,
                width: variant.width,
                height: variant.height,
              },
            });

            // Create variant images if provided
            if (variant.images && variant.images.length > 0) {
              await tx.variantImage.createMany({
                data: variant.images.map((url, index) => ({
                  url,
                  displayOrder: index,
                  productVariantId: newVariant.id,
                })),
              });
            }

            // Link variant to values using temp ID -> DB ID mapping
            for (const tempValueId of variant.valueIds) {
              const dbValueId = valueTempIdToDbId.get(tempValueId);
              if (dbValueId) {
                await tx.productVariantValue.create({
                  data: {
                    productVariantId: newVariant.id,
                    variantValueId: dbValueId,
                  },
                });
              }
            }
          }
        }
      }

      return newProduct;
    }, {
      maxWait: 10000, // 10 seconds
      timeout: 20000, // 20 seconds
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/products] Error:", error);
    if (error instanceof z.ZodError) {
      console.error("[POST /api/admin/products] Validation errors:", JSON.stringify(error.issues, null, 2));
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    // Log more details about the error
    if (error instanceof Error) {
      console.error("[POST /api/admin/products] Error message:", error.message);
      console.error("[POST /api/admin/products] Error stack:", error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/admin/products] Error message:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
