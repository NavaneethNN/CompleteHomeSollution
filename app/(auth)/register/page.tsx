import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterForm from "./_components/register-form";

export const metadata: Metadata = {
  title: "Create Account — Join Complete Home Sollution",
  description:
    "Create your free Complete Home Sollution account. Shop premium furniture with member-exclusive discounts up to 30% and fast Australia-wide delivery.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 text-primary" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
