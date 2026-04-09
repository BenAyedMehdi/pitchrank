import { Navigate } from "react-router-dom";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthed = localStorage.getItem("admin_auth") === "true";
  if (!isAuthed) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
