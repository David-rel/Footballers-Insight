"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    signOut({ redirect: true, callbackUrl: "/login" });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-white/70">Signing out...</p>
    </div>
  );
}

