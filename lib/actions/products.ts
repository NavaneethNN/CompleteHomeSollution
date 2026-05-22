"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Validation schemas
const variantAttributeSchema = z.object({
  name: z.string().min(1, "Attribute name is required"),
  displayOrder: z.number().default(0),
});

const variantValueSchema = z.object({
  value: z.string().min(1, "Value is required"),
  hexCode: z.string().optional(),
});

const productVariantSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  price: z.number().positive("Price must be positive"),
  comparePrice: z.number().positive("Compare price must be positive").optional(),
  memberPrice: z.number().positive("Member price must be positive").optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
  isActive: z.boolean().default(true),
  variantValueIds: z.array(z.string()).min(1, "At least one variant value is required"),
  images: z.array(z.string()).optional(),
  weight: z.number().positive().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

// Types
export interface VariantAttributeWithValues {
  id: string;
  name: string;
  displayOrder: number;
  values: {
    id: string;
    value: string;
    hexCode: string | null;
  }[];
}

export interface ProductVariantWithDetails {
  id: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  memberPrice: number | null;
  stock: number;
  isActive: boolean;
  values: {
    id: string;
    value: string;
    hexCode: string | null;
    attribute: {
      id: string;
      name: string;
    };
  }[];
  images: {
    id: string;
    url: string;
    alt: string | null;
  }[];
}

/**
 * Create a variant attribute (category) for a product
 */
export async function createVariantAttribute(
  productId: string,
  data: { name: string; displayOrder?: number }
) {
  try {
    const validated = variantAttributeSchema.parse(data);
    
    const attribute = await db.variantAttribute.create({
      data: {
        name: validated.name,
        displayOrder: validated.displayOrder,
        productId,
      },
    });

    // Update product to mark as having variants
    await db.product.update({
      where: { id: productId },
      data: { hasVariants: true },
    });

    revalidatePath(`/admin/products/${productId}`);
    return { success: true, attribute };
  } catch (error) {
    console.error("[createVariantAttribute] Error:", error);
    return { success: false, error: "Failed to create variant attribute" };
  }
}

/**
 * Add a variant value to an attribute
 */
export async function createVariantValue(
  variantAttributeId: string,
  data: { value: string; hexCode?: string }
) {
  try {
    const validated = variantValueSchema.parse(data);
    
    const value = await db.variantValue.create({
      data: {
        value: validated.value,
        hexCode: validated.hexCode,
        variantAttributeId,
      },
    });

    revalidatePath(`/admin/products`);
    return { success: true, value };
  } catch (error) {
    console.error("[createVariantValue] Error:", error);
    return { success: false, error: "Failed to create variant value" };
  }
}

/**
 * Create a product variant (sellable combination)
 */
export async function createProductVariant(
  productId: string,
  data: {
    sku: string;
    price: number;
    comparePrice?: number;
    memberPrice?: number;
    stock?: number;
    isActive?: boolean;
    variantValueIds: string[];
    images?: string[];
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
  }
) {
  try {
    const validated = productVariantSchema.parse(data);

    // Check if SKU is unique
    const existing = await db.productVariant.findUnique({
      where: { sku: validated.sku },
    });

    if (existing) {
      return { success: false, error: "SKU already exists" };
    }

    // Create variant with connected values
    const variant = await db.productVariant.create({
      data: {
        sku: validated.sku,
        price: validated.price,
        comparePrice: validated.comparePrice,
        memberPrice: validated.memberPrice,
        stock: validated.stock,
        isActive: validated.isActive,
        weight: validated.weight,
        length: validated.length,
        width: validated.width,
        height: validated.height,
        productId,
        values: {
          create: validated.variantValueIds.map((valueId) => ({
            variantValue: { connect: { id: valueId } },
          })),
        },
        images: {
          create: validated.images?.map((url, index) => ({
            url,
            displayOrder: index,
          })) || [],
        },
      },
      include: {
        values: {
          include: {
            variantValue: {
              include: {
                variantAttribute: true,
              },
            },
          },
        },
        images: true,
      },
    });

    revalidatePath(`/admin/products/${productId}`);
    return { success: true, variant };
  } catch (error) {
    console.error("[createProductVariant] Error:", error);
    return { success: false, error: "Failed to create product variant" };
  }
}

/**
 * Get all variant attributes for a product
 */
export async function getProductVariantAttributes(productId: string): Promise<{
  success: boolean;
  attributes?: VariantAttributeWithValues[];
  error?: string;
}> {
  try {
    const attributes = await db.variantAttribute.findMany({
      where: { productId },
      orderBy: { displayOrder: "asc" },
      include: {
        variantValues: {
          orderBy: { value: "asc" },
          select: {
            id: true,
            value: true,
            hexCode: true,
          },
        },
      },
    });

    return {
      success: true,
      attributes: attributes.map((attr) => ({
        id: attr.id,
        name: attr.name,
        displayOrder: attr.displayOrder,
        values: attr.variantValues,
      })),
    };
  } catch (error) {
    console.error("[getProductVariantAttributes] Error:", error);
    return { success: false, error: "Failed to fetch variant attributes" };
  }
}

/**
 * Get all product variants with details
 */
export async function getProductVariants(productId: string): Promise<{
  success: boolean;
  variants?: ProductVariantWithDetails[];
  error?: string;
}> {
  try {
    const variants = await db.productVariant.findMany({
      where: { productId },
      include: {
        values: {
          include: {
            variantValue: {
              include: {
                variantAttribute: true,
              },
            },
          },
        },
        images: {
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      variants: variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: variant.price,
        comparePrice: variant.comparePrice,
        memberPrice: variant.memberPrice,
        stock: variant.stock,
        isActive: variant.isActive,
        values: variant.values.map((v) => ({
          id: v.variantValue.id,
          value: v.variantValue.value,
          hexCode: v.variantValue.hexCode,
          attribute: {
            id: v.variantValue.variantAttribute.id,
            name: v.variantValue.variantAttribute.name,
          },
        })),
        images: variant.images,
      })),
    };
  } catch (error) {
    console.error("[getProductVariants] Error:", error);
    return { success: false, error: "Failed to fetch product variants" };
  }
}

/**
 * Update product variant
 */
export async function updateProductVariant(
  variantId: string,
  data: {
    price?: number;
    comparePrice?: number | null;
    memberPrice?: number | null;
    stock?: number;
    isActive?: boolean;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
  }
) {
  try {
    const variant = await db.productVariant.update({
      where: { id: variantId },
      data: {
        ...(data.price !== undefined && { price: data.price }),
        ...(data.comparePrice !== undefined && { comparePrice: data.comparePrice }),
        ...(data.memberPrice !== undefined && { memberPrice: data.memberPrice }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.length !== undefined && { length: data.length }),
        ...(data.width !== undefined && { width: data.width }),
        ...(data.height !== undefined && { height: data.height }),
      },
    });

    revalidatePath(`/admin/products/${variant.productId}`);
    return { success: true, variant };
  } catch (error) {
    console.error("[updateProductVariant] Error:", error);
    return { success: false, error: "Failed to update product variant" };
  }
}

/**
 * Delete product variant
 */
export async function deleteProductVariant(variantId: string) {
  try {
    const variant = await db.productVariant.delete({
      where: { id: variantId },
    });

    revalidatePath(`/admin/products/${variant.productId}`);
    return { success: true };
  } catch (error) {
    console.error("[deleteProductVariant] Error:", error);
    return { success: false, error: "Failed to delete product variant" };
  }
}

/**
 * Add images to a variant
 */
export async function addVariantImages(
  variantId: string,
  images: { url: string; alt?: string }[]
) {
  try {
    const created = await db.variantImage.createMany({
      data: images.map((img, index) => ({
        url: img.url,
        alt: img.alt,
        displayOrder: index,
        productVariantId: variantId,
      })),
    });

    revalidatePath(`/admin/products`);
    return { success: true, count: created.count };
  } catch (error) {
    console.error("[addVariantImages] Error:", error);
    return { success: false, error: "Failed to add variant images" };
  }
}

/**
 * Delete variant attribute (cascades to values and variant associations)
 */
export async function deleteVariantAttribute(attributeId: string) {
  try {
    await db.variantAttribute.delete({
      where: { id: attributeId },
    });

    revalidatePath(`/admin/products`);
    return { success: true };
  } catch (error) {
    console.error("[deleteVariantAttribute] Error:", error);
    return { success: false, error: "Failed to delete variant attribute" };
  }
}

/**
 * Delete variant value
 */
export async function deleteVariantValue(valueId: string) {
  try {
    await db.variantValue.delete({
      where: { id: valueId },
    });

    revalidatePath(`/admin/products`);
    return { success: true };
  } catch (error) {
    console.error("[deleteVariantValue] Error:", error);
    return { success: false, error: "Failed to delete variant value" };
  }
}

// Product creation schema
const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().min(1, "Description is required"),
  basePrice: z.number().min(0).default(0),
  comparePrice: z.number().min(0).optional(),
  memberPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0),
  sku: z.string().min(1, "SKU is required"),
  images: z.array(z.string()).default([]),
  material: z.string().optional(),
  roomType: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  hasVariants: z.boolean().default(false),
  weight: z.number().positive().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

/**
 * Create a new product
 */
export async function createProduct(data: {
  name: string;
  slug: string;
  description: string;
  basePrice?: number;
  comparePrice?: number;
  memberPrice?: number;
  stock?: number;
  sku: string;
  images?: string[];
  material?: string;
  roomType?: string;
  categoryId: string;
  hasVariants?: boolean;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}) {
  try {
    const validated = createProductSchema.parse(data);

    // Check if slug is unique
    const existingSlug = await db.product.findUnique({
      where: { slug: validated.slug },
    });
    if (existingSlug) {
      return { success: false, error: "A product with this slug already exists" };
    }

    // Check if SKU is unique
    const existingSku = await db.product.findUnique({
      where: { sku: validated.sku },
    });
    if (existingSku) {
      return { success: false, error: "A product with this SKU already exists" };
    }

    const product = await db.product.create({
      data: validated,
    });

    revalidatePath("/products");
    revalidatePath("/admin/products");
    return { success: true, product };
  } catch (error) {
    console.error("[createProduct] Error:", error);
    return { success: false, error: "Failed to create product" };
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(
  productId: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    basePrice: number;
    comparePrice: number | null;
    memberPrice: number | null;
    stock: number;
    images: string[];
    material: string | null;
    roomType: string | null;
    categoryId: string;
    isActive: boolean;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
  }>
) {
  try {
    const product = await db.product.update({
      where: { id: productId },
      data,
    });

    revalidatePath("/products");
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/admin/products");
    return { success: true, product };
  } catch (error) {
    console.error("[updateProduct] Error:", error);
    return { success: false, error: "Failed to update product" };
  }
}

/**
 * Delete a product and all its associated data
 */
export async function deleteProduct(productId: string) {
  try {
    // This will cascade delete all related data (variants, variant values, images, etc.)
    await db.product.delete({
      where: { id: productId },
    });

    revalidatePath("/products");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (error) {
    console.error("[deleteProduct] Error:", error);
    return { success: false, error: "Failed to delete product" };
  }
}
