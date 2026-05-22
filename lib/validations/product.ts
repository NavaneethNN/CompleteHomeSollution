import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().min(10, "Description is required"),
  price: z.number().positive("Price must be positive"),
  comparePrice: z.number().positive().optional(),
  memberPrice: z.number().positive().optional(),
  stock: z.number().int().min(0),
  sku: z.string().min(2, "SKU is required"),
  images: z.array(z.string().url()).min(1, "At least one image is required"),
  categoryId: z.string().cuid(),
  material: z.string().optional(),
  roomType: z.string().optional(),
  weight: z.number().positive().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const productFiltersSchema = z.object({
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  material: z.string().optional(),
  roomType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(["price_asc", "price_desc", "newest", "popular"]).default("newest"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
