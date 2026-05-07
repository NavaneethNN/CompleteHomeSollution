import type { Metadata } from "next";
import RegisterForm from "./_components/register-form";

export const metadata: Metadata = {
  title: "Create Account — Join Complete Home Sollution",
  description:
    "Create your free Complete Home Sollution account. Shop premium furniture with member-exclusive discounts up to 30% and fast Australia-wide delivery.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
