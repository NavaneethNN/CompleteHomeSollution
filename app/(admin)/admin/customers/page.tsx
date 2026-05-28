import type { Metadata } from "next";
import Link from "next/link";
import { getAdminCustomers } from "@/lib/actions/admin-customers";
import { CustomersClient } from "@/components/admin/customers-client";
import { Users, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Customers — Admin" };

interface CustomersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  const { page: pageParam, search } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const { customers, totalCount, totalPages } = await getAdminCustomers(page, search);

  // Calculate stats from all customers (not just paginated ones would need separate query)
  const totalMembers = customers.filter((c) => c.isMember).length;
  const totalAdmins = customers.filter((c) => c.role === "ADMIN").length;

  const CUSTOMERS_PER_PAGE = 20;

  return (
    <div className="space-y-6 p-4 sm:p-6 w-full max-w-none">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">
            {totalCount.toLocaleString()} total · Manage customer accounts
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-900">{totalCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Members</p>
                <p className="text-2xl font-bold text-slate-900">{totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Admins</p>
                <p className="text-2xl font-bold text-slate-900">{totalAdmins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">This Page</p>
                <p className="text-2xl font-bold text-slate-900">{customers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="w-full">
        <CardContent className="p-3 sm:p-4">
          <form className="flex gap-2" action="/admin/customers">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                name="search"
                defaultValue={search}
                placeholder="Search customers by name or email..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="shrink-0">
              <Search className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Search</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            Customers ({totalCount.toLocaleString()})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full">
          <CustomersClient 
            initialCustomers={customers}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-4 border-t border-slate-200">
              <p className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
                Showing {(page - 1) * CUSTOMERS_PER_PAGE + 1}-{" "}
                {Math.min(page * CUSTOMERS_PER_PAGE, totalCount)} of{" "}
                {totalCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  href={`/admin/customers?page=${Math.max(1, page - 1)}${search ? `&search=${search}` : ""}`}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                </Link>
                <span className="text-sm text-slate-600 px-1 sm:px-2">
                  {page}/{totalPages}
                </span>
                <Link
                  href={`/admin/customers?page=${Math.min(totalPages, page + 1)}${search ? `&search=${search}` : ""}`}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" disabled={page >= totalPages}>
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4 sm:ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
