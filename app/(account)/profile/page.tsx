import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/actions/profile";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = { title: "Edit Profile — Complete Home Sollution" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 xl:px-10 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <AccountSidebar user={session.user} />
          <ProfileForm profile={profile} />
        </div>
      </div>
    </div>
  );
}
