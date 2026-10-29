import type { Metadata } from "next";
import LoginForm from "./_components/login-form";

export const metadata: Metadata = {
  title: "Sign In — Complete Home Sollution",
  description:
    "Sign in to your Complete Home Sollution account. Access your orders, manage your profile, and unlock member-exclusive prices or 5% off (up to $30).",
};

export default function LoginPage() {
  return <main className="flex flex-1 flex-col"><LoginForm /></main>;
}
