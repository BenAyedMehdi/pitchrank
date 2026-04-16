import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Settings, Users, Mic, Radio, Trophy } from "lucide-react";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";
import { cn } from "@/lib/utils";

interface AdminSessionLayoutProps {
  children: React.ReactNode;
  sessionName?: string;
  sessionCode?: string;
  status?: "setup" | "active" | "closed";
  isLive?: boolean;
  containerClassName?: string;
  contentClassName?: string;
}

interface CachedHeader {
  name: string;
  join_code: string;
  status: "setup" | "active" | "closed";
}

function readHeaderCache(id: string): CachedHeader | null {
  try {
    const raw = sessionStorage.getItem(`session_header_${id}`);
    return raw ? (JSON.parse(raw) as CachedHeader) : null;
  } catch {
    return null;
  }
}

function writeHeaderCache(id: string, data: CachedHeader) {
  try {
    sessionStorage.setItem(`session_header_${id}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

const TABS = [
  { key: "setup", label: "Setup", icon: Settings, path: "setup" },
  { key: "lobby", label: "Lobby", icon: Users, path: "lobby" },
  { key: "pitch", label: "Pitch", icon: Mic, path: "pitch" },
  { key: "results", label: "Results", icon: Trophy, path: "results" },
] as const;

export function AdminSessionLayout({
  children,
  sessionName,
  sessionCode,
  status,
  isLive = false,
  containerClassName,
  contentClassName,
}: AdminSessionLayoutProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  // Seed from cache so the header never flashes placeholder values on tab navigation
  const [cached, setCached] = useState<CachedHeader | null>(() =>
    id ? readHeaderCache(id) : null
  );

  // Persist to cache whenever we receive real session data from the page
  useEffect(() => {
    if (id && sessionName && sessionCode && status) {
      const data: CachedHeader = { name: sessionName, join_code: sessionCode, status };
      writeHeaderCache(id, data);
      setCached(data);
    }
  }, [id, sessionName, sessionCode, status]);

  const displayName = sessionName ?? cached?.name ?? "Loading…";
  const displayCode = sessionCode ?? cached?.join_code ?? "------";
  const displayStatus = status ?? cached?.status ?? "active";
  const displayLive = isLive || (cached?.status === "active" && !status);

  const currentTab = TABS.find((t) => location.pathname.endsWith(`/${t.path}`))?.key ?? "setup";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
        <div className={cn("max-w-[480px] mx-auto px-4", containerClassName)}>
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
                <h1 className="font-heading text-sm font-semibold truncate">{displayName}</h1>
                {displayLive && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-success uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <JoinCodeDisplay code={displayCode} />
                <SessionStatusBadge status={displayStatus} />
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
        <div className={cn("max-w-[480px] mx-auto px-4 py-5", containerClassName, contentClassName)}>
          {children}
        </div>
      </main>
    </div>
  );
}
