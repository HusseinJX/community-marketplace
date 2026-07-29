"use client";

import { LoginModal } from "@/components/auth/LoginModal";

// Vendor login — now a thin wrapper over the shared LoginModal (variant "vendor").
// Kept as its own export so existing callers (/join, /vendor/sign-in) are
// unchanged. Accounts are Google/Apple only; phone is business-verification only.
export function VendorPhoneLogin({
  onClose,
  redirectUrl = "/vendor",
}: {
  onClose: () => void;
  redirectUrl?: string;
}) {
  return <LoginModal variant="vendor" onClose={onClose} redirectUrl={redirectUrl} />;
}
