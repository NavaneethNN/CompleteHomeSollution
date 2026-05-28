import { z } from "zod";

export const addressSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
  phone: z.string().min(1, "Phone number is required").max(20, "Phone number is too long"),
  line1: z.string().min(1, "Street address is required").max(100, "Address is too long"),
  line2: z.string().max(100, "Address is too long").optional(),
  suburb: z.string().min(1, "Suburb is required").max(50, "Suburb name is too long"),
  state: z.string().min(1, "State is required"),
  postcode: z
    .string()
    .min(1, "Postcode is required")
    .regex(/^\d{4}$/, "Enter a valid 4-digit Australian postcode"),
  country: z.string().min(1, "Country is required"),
});

export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
  phone: z.string().max(20).optional(),
  image: z.string().max(500).optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
