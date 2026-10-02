import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Log in · Pinky" };

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
