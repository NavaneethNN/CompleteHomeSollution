import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { UserCircle, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Edit Profile — Complete Home Sollution" };

export default async function ProfilePage() {
  const session = await auth();
  const user = session!.user;
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/account/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Profile</span>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden max-w-xl">
          <div className="px-6 py-5 border-b border-border">
            <h1 className="font-bold text-lg text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your account information</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name ?? ""}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center ring-2 ring-border">
                  <span className="text-xl font-black text-white">{initials}</span>
                </div>
              )}
              <div>
                <p className="font-semibold text-foreground">{user.name ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Full Name",  value: user.name  ?? "Not set" },
                { label: "Email",      value: user.email ?? "Not set" },
                { label: "Role",       value: user.role  ?? "CUSTOMER" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/60 rounded-xl p-4">
              <UserCircle className="h-4 w-4 shrink-0" />
              Profile editing will be available soon.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
