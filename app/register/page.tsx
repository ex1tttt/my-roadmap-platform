import { Suspense } from "react";
import RegisterForm from "./RegisterForm";

export default function Page() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
