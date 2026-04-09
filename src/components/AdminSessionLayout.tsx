import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Settings, Users, Mic, Radio } from "lucide-react";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { cn } from "@/lib/utils";

interface AdminSessionLayoutProps {
  children: React.ReactNode;
  sessionName?: string;
  sessionCode?: string;
  status?: "setup" | "active" | "closed";
  isLive?: boolean;
}

const TABS = [
  { key: "setup", label: "Setup", icon: Settings, path: "setup" },
  { key: "lobby", label: "Lobby", icon: Users, path: "lobby" },
  { key: "pitch", label: "Pitch", icon: Mic, path: "pitch" },
] as const;

export function AdminSessionLayout({
  children,
  sessionName = "IT Hub Hackathon 2025",
  sessionCode = "HACK24",
  status = "active",
  isLive = false,
}: AdminSessionLayoutProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const currentTab = TABS.find((t) => location.pathname.endsWith(`/${t.path}`))?.key ?? "setup";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-[480px] mx-auto px-4">
          {/* Top row: back + session info */}
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => navigate("/admin/sessions")}
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary transition-colors shrink-0"
            >
              <ArrowLeft className="w-4.5 h-4.5 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-sm font-semibold truncate">{sessionName}</h1>
                {isLive && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-success uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <JoinCodeDisplay code={sessionCode} />
                <SessionStatusBadge status={status} />
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 -mb-px">
            {TABS.map((tab) => {
              const active = tab.key === currentTab;
              return (
                <button
                  key={tab.key}
                  onClick={() => navigate(`/admin/sessions/${id}/${tab.path}`)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 rounded-t-md",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-[480px] mx-auto px-4 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
