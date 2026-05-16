import { z } from "zod";

export const auAddressSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  phone: z.string().min(1, "Phone number is required").max(20, "Phone number is too long"),
  line1: z.string().min(3, "Address line 1 is required"),
  line2: z.string().optional(),
  suburb: z.string().min(2, "Suburb is required"),
  state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"], {
    message: "Select a valid Australian state",
  }),
  postcode: z
    .string()
    .length(4, "Australian postcodes are 4 digits")
    .regex(/^\d{4}$/, "Postcode must be 4 digits"),
  country: z.literal("AU").default("AU"),
});

export const guestCheckoutSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z
    .string()
    .regex(/^\+?61[0-9]{9}$|^0[0-9]{9}$/, "Enter a valid Australian phone number"),
  address: auAddressSchema,
});

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "Cart cannot be empty"),
  address: auAddressSchema,
  shippingServiceLevel: z.enum(["standard", "express", "priority"]).optional(),
  guestInfo: z
    .object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
    })
    .optional(),
});

export type AuAddress = z.infer<typeof auAddressSchema>;
export type GuestCheckout = z.infer<typeof guestCheckoutSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
