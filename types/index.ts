export type { CartItem, CartProduct } from "@/store/cart";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export type UserRole = "ADMIN" | "MEMBER" | "CUSTOMER";
export type OrderStatus =
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  memberPrice?: number;
  stock: number;
  images: string[];
  category: { id: string; name: string; slug: string };
  _count?: { reviews: number };
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: { quantity: number; product: { name: string; images: string[] } }[];
}
