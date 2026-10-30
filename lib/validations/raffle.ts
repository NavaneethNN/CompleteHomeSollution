import { z } from "zod";

export const rafflePrizeSchema = z.object({
  id: z.string().optional(),
  rank: z.number().int().min(1, "Rank must be at least 1"),
  name: z.string().min(2, "Prize name must be at least 2 characters"),
  description: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  value: z.number().min(0, "Prize value must be 0 or greater"),
  prizeType: z.enum(["FREE_PRODUCT", "PAID_PRODUCT"]).default("FREE_PRODUCT"),
  price: z.number().min(0, "Prize price must be 0 or greater").default(0),
  quantity: z.number().int().min(1, "Prize quantity must be at least 1").default(1),
  productId: z.string().optional().nullable(),
  productVariantId: z.string().optional().nullable(),
});

export const raffleFormSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title is too long"),
    slug: z
      .string()
      .min(3, "Slug must be at least 3 characters")
      .max(100, "Slug is too long")
      .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
    shortDescription: z.string().optional().nullable(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    bannerImage: z.string().optional().nullable(),
    images: z.array(z.string()).default([]),
    status: z.enum([
      "DRAFT",
      "UPCOMING",
      "ACTIVE",
      "CLOSED",
      "DRAW_PENDING",
      "DRAW_COMPLETED",
      "WINNER_VERIFICATION",
      "COMPLETED",
      "PAUSED",
      "CANCELLED",
    ]).default("DRAFT"),
    entryPrice: z.number().min(0).default(0),
    isPaid: z.boolean().default(false),
    visibility: z.enum(["ALL", "MEMBERS_ONLY"]).default("ALL"),
    eligiblePlanIds: z.array(z.string()).default([]),
    maxEntriesPerUser: z.number().int().min(1).default(1),
    minEntriesPerUser: z.number().int().min(1).default(1),
    totalMaxEntries: z.number().int().min(1).optional().nullable(),
    allowMultipleEntries: z.boolean().default(false),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    drawDate: z.string().min(1, "Draw date is required"),
    automaticClosure: z.boolean().default(true),
    terms: z.string().optional().nullable(),
    ageRestriction: z.number().int().min(0).optional().nullable(),
    geographicRestriction: z.string().optional().nullable(),
    isFeatured: z.boolean().default(false),
    displayOnHomepage: z.boolean().default(false),
    prizes: z.array(rafflePrizeSchema).min(1, "At least one prize is required"),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "Campaign end date must be after start date",
    path: ["endDate"],
  })
  .refine((data) => new Date(data.drawDate) >= new Date(data.endDate), {
    message: "Draw date must be on or after campaign closing date",
    path: ["drawDate"],
  });

export type RaffleFormData = z.infer<typeof raffleFormSchema>;
export type RafflePrizeFormData = z.infer<typeof rafflePrizeSchema>;

export const claimPrizeAddressSchema = z.object({
  winnerId: z.string().min(1, "Winner ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  phone: z
    .string()
    .min(8, "Phone must be at least 8 digits")
    .max(20, "Phone number is too long")
    .regex(/^[\d\s+()-]+$/, "Please enter a valid phone number"),
  line1: z.string().min(3, "Street address is required").max(150, "Address is too long"),
  line2: z.string().max(100, "Line 2 is too long").optional().nullable(),
  suburb: z.string().min(2, "Suburb is required").max(100, "Suburb is too long"),
  state: z.string().min(2, "State is required").max(50, "State is too long"),
  postcode: z.string().min(3, "Postcode is required").max(10, "Postcode is too long"),
  country: z.string().default("AU"),
  saveToProfile: z.boolean().default(false),
});

export type ClaimPrizeAddressInput = z.infer<typeof claimPrizeAddressSchema>;

export const raffleFulfilmentSchema = z.object({
  winnerId: z.string().min(1, "Winner ID is required"),
  carrier: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  deliveryStatus: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"]),
  notes: z.string().optional().nullable(),
});

export type RaffleFulfilmentInput = z.infer<typeof raffleFulfilmentSchema>;

