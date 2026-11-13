/**
 * /admin/support — user feedback & complaints (reuses the existing real
 * FeedbackDashboard against the feedbacks table, inside the admin shell).
 */
import { useAuth } from "@/hooks/use-auth";
import { AdminPageHeader } from "../ui";
import { PermissionGuard } from "../AdminLayout";
import { FeedbackDashboard } from "@/pages/admin/FeedbackDashboard";
import type { AdminRole } from "../admin-rbac";

export default function AdminSupport() {
  const { user } = useAuth();
  const myRole = (user?.role || "") as AdminRole;
  return (
    <PermissionGuard role={myRole} permission="support.view">
      <AdminPageHeader
        title="Support & Feedback"
        subtitle="User feedback and complaints from the feedbacks table. Status and priority changes are recorded in feedback_activity with the acting administrator."
      />
      <FeedbackDashboard />
    </PermissionGuard>
  );
}
