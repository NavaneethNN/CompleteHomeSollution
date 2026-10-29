import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import slugify from "slugify";
import { cacheDel, CACHE_KEYS } from "@/lib/redis";

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
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().nullable(),
  bulletTitle: z.string().max(100).optional().nullable(),
  bulletPoints: z.array(z.string()).max(20).default([]),
  weight: z.number().optional().nullable(),
  length: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional().nullable(),
  bulletTitle: z.string().max(100).optional().nullable(),
  bulletPoints: z.array(z.string()).max(20).default([]).optional(),
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
          orderBy: { displayOrder: "asc" },
          include: {
            variantValues: {
              orderBy: { createdAt: "asc" },
            },
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
              orderBy: { displayOrder: "asc" },
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
      const baseSlug = slugify(data.name, { lower: true, strict: true }) || "product";
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
      if (data.bulletTitle !== undefined) updateData.bulletTitle = data.bulletTitle;
      if (data.bulletPoints !== undefined) updateData.bulletPoints = data.bulletPoints;
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

      // 2. If variant data is provided in the payload
      if (data.variantAttributes !== undefined || data.productVariants !== undefined) {
        if (data.hasVariants && data.variantAttributes && data.variantAttributes.length > 0) {
          // Reconcile variant attributes & values
          const existingAttrs = await tx.variantAttribute.findMany({
            where: { productId: id },
            include: { variantValues: true },
          });

          const attrTempIdToDbId = new Map<string, string>();
          const valueTempIdToDbId = new Map<string, string>();
          const keptAttrIds = new Set<string>();
          const keptValueIds = new Set<string>();

          for (const attr of data.variantAttributes) {
            const existingAttr = existingAttrs.find((ea) => ea.id === attr.id);
            let dbAttrId: string;

            if (existingAttr) {
              await tx.variantAttribute.update({
                where: { id: existingAttr.id },
                data: {
                  name: attr.name,
                  displayOrder: attr.displayOrder,
                  isPrimary: attr.isPrimary ?? false,
                },
              });
              dbAttrId = existingAttr.id;
            } else {
              const newAttr = await tx.variantAttribute.create({
                data: {
                  name: attr.name,
                  displayOrder: attr.displayOrder,
                  isPrimary: attr.isPrimary ?? false,
                  productId: id,
                },
              });
              dbAttrId = newAttr.id;
            }

            attrTempIdToDbId.set(attr.id, dbAttrId);
            keptAttrIds.add(dbAttrId);

            const existingValues = existingAttr ? existingAttr.variantValues : [];

            for (const val of attr.values) {
              const existingVal = existingValues.find((ev) => ev.id === val.id);
              let dbValId: string;

              if (existingVal) {
                await tx.variantValue.update({
                  where: { id: existingVal.id },
                  data: {
                    value: val.value,
                    hexCode: val.hexCode,
                    images: val.images ?? [],
                  },
                });
                dbValId = existingVal.id;
              } else {
                const newVal = await tx.variantValue.create({
                  data: {
                    value: val.value,
                    hexCode: val.hexCode,
                    images: val.images ?? [],
                    variantAttributeId: dbAttrId,
                  },
                });
                dbValId = newVal.id;
              }

              valueTempIdToDbId.set(val.id, dbValId);
              keptValueIds.add(dbValId);
            }
          }

          // Delete attributes/values that were removed
          for (const ea of existingAttrs) {
            if (!keptAttrIds.has(ea.id)) {
              await tx.variantAttribute.delete({ where: { id: ea.id } });
            } else {
              for (const ev of ea.variantValues) {
                if (!keptValueIds.has(ev.id)) {
                  await tx.variantValue.delete({ where: { id: ev.id } });
                }
              }
            }
          }

          // Reconcile product variants
          const existingVariants = await tx.productVariant.findMany({
            where: { productId: id },
            include: {
              values: true,
              images: true,
            },
          });

          const keptVariantIds = new Set<string>();

          if (data.productVariants && data.productVariants.length > 0) {
            for (const variant of data.productVariants) {
              // Convert frontend valueIds (which might be temp IDs) to DB IDs
              const resolvedDbValueIds = variant.valueIds
                .map((tempId) => valueTempIdToDbId.get(tempId) || tempId)
                .filter(Boolean);

              // Find if this variant already exists:
              // Match by SKU first, or by identical valueIds
              const matchedVariant = existingVariants.find((ev) => {
                if (ev.sku.trim().toLowerCase() === variant.sku.trim().toLowerCase()) return true;
                const existingValIds = ev.values.map((v) => v.variantValueId).sort().join(",");
                const currentValIds = [...resolvedDbValueIds].sort().join(",");
                return existingValIds.length > 0 && existingValIds === currentValIds;
              });

              let currentVariantId: string;

              if (matchedVariant) {
                currentVariantId = matchedVariant.id;
                await tx.productVariant.update({
                  where: { id: matchedVariant.id },
                  data: {
                    sku: variant.sku.trim(),
                    price: variant.price,
                    comparePrice: variant.comparePrice,
                    memberPrice: variant.memberPrice,
                    stock: variant.stock,
                    isActive: variant.isActive,
                    description: variant.description || null,
                    bulletTitle: variant.bulletTitle || null,
                    bulletPoints: variant.bulletPoints || [],
                    weight: variant.weight,
                    length: variant.length,
                    width: variant.width,
                    height: variant.height,
                  },
                });

                // Replace variant images
                await tx.variantImage.deleteMany({
                  where: { productVariantId: matchedVariant.id },
                });
                if (variant.images && variant.images.length > 0) {
                  await tx.variantImage.createMany({
                    data: variant.images.map((url, index) => ({
                      url,
                      displayOrder: index,
                      productVariantId: matchedVariant.id,
                    })),
                  });
                }

                // Replace productVariantValues
                await tx.productVariantValue.deleteMany({
                  where: { productVariantId: matchedVariant.id },
                });
                for (const dbValueId of resolvedDbValueIds) {
                  await tx.productVariantValue.create({
                    data: {
                      productVariantId: matchedVariant.id,
                      variantValueId: dbValueId,
                    },
                  });
                }
              } else {
                // Create new variant
                const newVariant = await tx.productVariant.create({
                  data: {
                    productId: id,
                    sku: variant.sku.trim(),
                    price: variant.price,
                    comparePrice: variant.comparePrice,
                    memberPrice: variant.memberPrice,
                    stock: variant.stock,
                    isActive: variant.isActive,
                    description: variant.description || null,
                    bulletTitle: variant.bulletTitle || null,
                    bulletPoints: variant.bulletPoints || [],
                    weight: variant.weight,
                    length: variant.length,
                    width: variant.width,
                    height: variant.height,
                  },
                });
                currentVariantId = newVariant.id;

                if (variant.images && variant.images.length > 0) {
                  await tx.variantImage.createMany({
                    data: variant.images.map((url, index) => ({
                      url,
                      displayOrder: index,
                      productVariantId: newVariant.id,
                    })),
                  });
                }

                for (const dbValueId of resolvedDbValueIds) {
                  await tx.productVariantValue.create({
                    data: {
                      productVariantId: newVariant.id,
                      variantValueId: dbValueId,
                    },
                  });
                }
              }

              keptVariantIds.add(currentVariantId);
            }
          }

          // Handle removed variants safely
          for (const ev of existingVariants) {
            if (!keptVariantIds.has(ev.id)) {
              const orderCount = await tx.orderItem.count({
                where: { productVariantId: ev.id },
              });
              if (orderCount > 0) {
                // Keep historical order integrity: deactivate instead of hard delete
                await tx.productVariant.update({
                  where: { id: ev.id },
                  data: { isActive: false },
                });
              } else {
                // Safe to delete: remove cart items first, then variant
                await tx.cartItem.deleteMany({
                  where: { productVariantId: ev.id },
                });
                await tx.productVariantValue.deleteMany({
                  where: { productVariantId: ev.id },
                });
                await tx.variantImage.deleteMany({
                  where: { productVariantId: ev.id },
                });
                await tx.productVariant.delete({
                  where: { id: ev.id },
                });
              }
            }
          }
        } else if (data.hasVariants === false) {
          // Admin disabled variants for this product
          const existingVariants = await tx.productVariant.findMany({
            where: { productId: id },
          });

          for (const ev of existingVariants) {
            const orderCount = await tx.orderItem.count({
              where: { productVariantId: ev.id },
            });
            if (orderCount > 0) {
              await tx.productVariant.update({
                where: { id: ev.id },
                data: { isActive: false },
              });
            } else {
              await tx.cartItem.deleteMany({
                where: { productVariantId: ev.id },
              });
              await tx.productVariantValue.deleteMany({
                where: { productVariantId: ev.id },
              });
              await tx.variantImage.deleteMany({
                where: { productVariantId: ev.id },
              });
              await tx.productVariant.delete({
                where: { id: ev.id },
              });
            }
          }

          const remainingVariantCount = await tx.productVariant.count({
            where: { productId: id },
          });
          if (remainingVariantCount === 0) {
            await tx.variantValue.deleteMany({
              where: { variantAttribute: { productId: id } },
            });
            await tx.variantAttribute.deleteMany({
              where: { productId: id },
            });
          }
        }
      }

      // Return updated product with relations
      return await tx.product.findUnique({
        where: { id },
        include: {
          category: { select: { name: true } },
          variantAttributes: {
            orderBy: { displayOrder: "asc" },
            include: {
              variantValues: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
          productVariants: {
            include: {
              values: { include: { variantValue: true } },
              images: { orderBy: { displayOrder: "asc" } },
            },
          },
        },
      });
    }, {
      maxWait: 10000, // 10 seconds
      timeout: 20000, // 20 seconds
    });

    // Invalidate product & catalog caches across L1 and Upstash Redis
    const keysToInvalidate: string[] = [CACHE_KEYS.productsAll, CACHE_KEYS.homeTrending];
    if (product?.slug) {
      keysToInvalidate.push(CACHE_KEYS.product(product.slug));
    }
    await cacheDel(keysToInvalidate);

    return NextResponse.json({ product });
  } catch (error) {
    console.error("[PUT /api/admin/products/[id]]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const target = (error as any).meta?.target;
      const targetField = Array.isArray(target) ? target.join(", ") : target || "SKU";
      return NextResponse.json(
        { error: `A product or variant with this ${targetField} already exists. Please choose a unique ${targetField}.` },
        { status: 409 }
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

    // Invalidate product & catalog caches across L1 and Upstash Redis
    await cacheDel([CACHE_KEYS.productsAll, CACHE_KEYS.homeTrending, CACHE_KEYS.categories]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/products/[id]]", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
