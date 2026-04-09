import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AdminNavProps {
  title: string;
  backTo?: string;
}

export function AdminNav({ title, backTo }: AdminNavProps) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-3 py-4 px-1">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
      )}
      <h1 className="font-heading text-lg font-semibold truncate">{title}</h1>
    </nav>
  );
}
