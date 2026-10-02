import { Suspense } from "react";
import { SignupForm } from "@/components/auth-forms";

export const metadata = { title: "Sign up · Pinky" };

export default function Page() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
