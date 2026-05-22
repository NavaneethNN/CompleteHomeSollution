import type { Metadata } from "next";
import { getAdminCustomers } from "@/lib/actions/admin-customers";
import { CustomersClient } from "@/components/admin/customers-client";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Customers — Admin" };

export default async function AdminCustomersPage() {
  const customers = await getAdminCustomers();

  const totalMembers = customers.filter((c) => c.isMember).length;
  const totalAdmins  = customers.filter((c) => c.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers.length} total · {totalMembers} members · {totalAdmins} admins
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
      </div>

      <CustomersClient initialCustomers={customers} />
    </div>
  );
}
