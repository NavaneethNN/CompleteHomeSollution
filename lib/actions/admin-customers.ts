"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export type AdminCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  isMember: boolean;
  memberSince: Date | null;
  emailVerified: Date | null;
  createdAt: Date;
  _count: { orders: number };
  totalSpend: number;
};

const CUSTOMERS_PER_PAGE = 20;

export type PaginatedCustomers = {
  customers: AdminCustomer[];
  totalCount: number;
  totalPages: number;
};

export async function getAdminCustomers(
  page: number = 1,
  search?: string
): Promise<PaginatedCustomers> {
  await requireAdmin();

  const skip = (page - 1) * CUSTOMERS_PER_PAGE;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, totalCount] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: CUSTOMERS_PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isMember: true,
        memberSince: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { total: true },
        },
        membershipPayments: {
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({ where }),
  ]);

  const customers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role,
    isMember: u.isMember,
    memberSince: u.memberSince,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    _count: u._count,
    totalSpend:
      u.orders.reduce((sum, o) => sum + o.total, 0) +
      u.membershipPayments.reduce((sum, m) => sum + m.amount, 0),
  }));

  return {
    customers,
    totalCount,
    totalPages: Math.ceil(totalCount / CUSTOMERS_PER_PAGE),
  };
}

export type AdminCustomerDetail = AdminCustomer & {
  recentOrders: {
    id: string;
    status: string;
    total: number;
    createdAt: Date;
  }[];
};

export async function getAdminCustomerDetail(userId: string): Promise<AdminCustomerDetail | null> {
  await requireAdmin();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isMember: true,
      memberSince: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { orders: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, total: true, createdAt: true },
      },
    },
  });

  if (!user) return null;

  const [orderSpend, membershipSpend] = await Promise.all([
    db.order.aggregate({
      where: { userId, status: { not: "CANCELLED" } },
      _sum: { total: true },
    }),
    db.membershipPayment.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    isMember: user.isMember,
    memberSince: user.memberSince,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    _count: user._count,
    totalSpend: (orderSpend._sum.total ?? 0) + (membershipSpend._sum.amount ?? 0),
    recentOrders: user.orders,
  };
}

export async function setCustomerRole(userId: string, role: "ADMIN" | "CUSTOMER"): Promise<void> {
  await requireAdmin();
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/customers");
}

export async function setCustomerMembership(userId: string, isMember: boolean): Promise<void> {
  await requireAdmin();
  await db.user.update({
    where: { id: userId },
    data: {
      isMember,
      memberSince: isMember ? new Date() : null,
    },
  });
  revalidatePath("/admin/customers");
}
