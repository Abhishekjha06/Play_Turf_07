import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  // Matches Supabase's default minimum (6) — anything the server accepts must
  // pass here too, otherwise valid credentials are rejected client-side.
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
  // Length-only rule (Supabase's default minimum) — no uppercase/lowercase/
  // digit complexity requirements, so simple passwords like phone numbers
  // don't silently fail before the request ever reaches the server.
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const bookingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  hours: z.number().min(1, "Must book for at least 1 hour").max(12, "Maximum 12 hours allowed"),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
});

export const clientProfileUpdateSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type BookingFormValues = z.infer<typeof bookingSchema>;
export type ProfileUpdateFormValues = z.infer<typeof profileUpdateSchema>;
export type ClientProfileUpdateFormValues = z.infer<typeof clientProfileUpdateSchema>;
