"use client";

import { MANAGERS } from "@/lib/rbac";
import { useAuth } from "@/lib/auth";
import { AdminPage } from "@/components/AdminPage";
import { FaceVerifyDesk } from "@/components/attendance/FaceVerifyDesk";

export default function FaceVerifyPage() {
  const { user } = useAuth();
  const company = user?.role === "ADMIN" || user?.role === "CEO";

  return (
    <AdminPage
      title="Face verification"
      subtitle={
        company
          ? "Office webcam enroll and desk match for Sales, Ops, and Managers — Admin/CEO only controls plus managers of their team."
          : "Enroll and verify office faces for people who report to you. Camera stays on this desk only."
      }
      allowedRoles={MANAGERS}
    >
      <FaceVerifyDesk company={company} />
    </AdminPage>
  );
}
