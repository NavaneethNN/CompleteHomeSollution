import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import slugify from "slugify";

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

const updateProductSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().nullable(),
  basePrice: z.number().nonnegative().optional().nullable(),
  comparePrice: z.number().optional().nullable(),
  memberPrice: z.number().optional().nullable(),
  stock: z.number().int().min(0).optional().nullable(),
  sku: z.string().min(1).max(MAX_SKU_LENGTH).optional(),
  categoryId: z.string().optional(),
  material: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  images: z.array(z.string())
    .max(MAX_IMAGES_COUNT, `Maximum ${MAX_IMAGES_COUNT} images allowed`)
    .refine(
      (images) => images.every(img => validateImageSize(img)),
      `Each image must be under ${MAX_IMAGE_SIZE_MB}MB or a valid URL`
    )
    .optional(),
  weight: z.number().optional().nullable(),
  length: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  // For products with variants
  variantAttributes: z.array(variantAttributeSchema).optional(),
  productVariants: z.array(productVariantSchema).optional(),
});

// GET /api/admin/products/[id] - Get single product
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        variantAttributes: {
          include: {
            variantValues: true,
          },
        },
        productVariants: {
          include: {
            values: {
              select: {
                variantValueId: true,
              },
            },
            images: {
              select: {
                id: true,
                url: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[GET /api/admin/products/[id]]", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/products/[id] - Update product
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateProductSchema.parse(body);

    // If name is being updated, regenerate slug
    let slug: string | undefined;
    if (data.name) {
      const baseSlug = slugify(data.name, { lower: true, strict: true });
      slug = baseSlug;
      let counter = 1;

      // Ensure unique slug
      while (
        await db.product.findFirst({
          where: {
            slug,
            id: { not: id },
          },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Update product in a transaction to handle variants
    const product = await db.$transaction(async (tx) => {
      // 1. Update the base product
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
      if (data.comparePrice !== undefined) updateData.comparePrice = data.comparePrice;
      if (data.memberPrice !== undefined) updateData.memberPrice = data.memberPrice;
      if (data.stock !== undefined) updateData.stock = data.stock;
      if (data.sku !== undefined) updateData.sku = data.sku;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.material !== undefined) updateData.material = data.material;
      if (data.roomType !== undefined) updateData.roomType = data.roomType;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.hasVariants !== undefined) updateData.hasVariants = data.hasVariants;
      if (data.images !== undefined) updateData.images = data.images;
      if (data.weight !== undefined) updateData.weight = data.weight;
      if (data.length !== undefined) updateData.length = data.length;
      if (data.width !== undefined) updateData.width = data.width;
      if (data.height !== undefined) updateData.height = data.height;
      if (slug !== undefined) updateData.slug = slug;

      const updatedProduct = await tx.product.update({
        where: { id },
        data: updateData,
      });

      // 2. If variant data is provided in the payload, do a full clean-slate replace
      if (data.variantAttributes !== undefined || data.productVariants !== undefined) {
        // Always wipe existing variants + attributes first
        await tx.productVariantValue.deleteMany({
          where: { productVariant: { productId: id } },
        });
        await tx.variantImage.deleteMany({
          where: { productVariant: { productId: id } },
        });
        await tx.productVariant.deleteMany({
          where: { productId: id },
        });
        await tx.variantValue.deleteMany({
          where: { variantAttribute: { productId: id } },
        });
        await tx.variantAttribute.deleteMany({
          where: { productId: id },
        });

        // Re-create only if hasVariants and attributes are supplied
        if (data.hasVariants && data.variantAttributes && data.variantAttributes.length > 0) {
          const attrTempIdToDbId = new Map<string, string>();
          const valueTempIdToDbId = new Map<string, string>();

          for (const attr of data.variantAttributes) {
            const variantAttr = await tx.variantAttribute.create({
              data: {
                name: attr.name,
                displayOrder: attr.displayOrder,
                isPrimary: attr.isPrimary ?? false,
                productId: id,
              },
            });
            attrTempIdToDbId.set(attr.id, variantAttr.id);

            for (const val of attr.values) {
              const variantValue = await tx.variantValue.create({
                data: {
                  value: val.value,
                  hexCode: val.hexCode,
                  images: val.images ?? [],
                  variantAttributeId: variantAttr.id,
                },
              });
              valueTempIdToDbId.set(val.id, variantValue.id);
            }
          }

          if (data.productVariants && data.productVariants.length > 0) {
            for (const variant of data.productVariants) {
              const newVariant = await tx.productVariant.create({
                data: {
                  productId: id,
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

              if (variant.images && variant.images.length > 0) {
                await tx.variantImage.createMany({
                  data: variant.images.map((url, index) => ({
                    url,
                    displayOrder: index,
                    productVariantId: newVariant.id,
                  })),
                });
              }

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
      }

      // Return updated product with relations
      return await tx.product.findUnique({
        where: { id },
        include: {
          category: { select: { name: true } },
          variantAttributes: {
            include: { variantValues: true },
          },
          productVariants: {
            include: {
              values: { include: { variantValue: true } },
              images: true,
            },
          },
        },
      });
    }, {
      maxWait: 10000, // 10 seconds
      timeout: 20000, // 20 seconds
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[PUT /api/admin/products/[id]]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to update product";
    console.error("[PUT /api/admin/products/[id]] Error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Delete product
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/products/[id]]", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
