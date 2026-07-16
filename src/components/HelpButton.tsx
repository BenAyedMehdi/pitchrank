import { useNavigate, useLocation } from "react-router-dom";

export function HelpButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show the button on the help page itself
  if (location.pathname === "/help") return null;

  return (
    <button
      onClick={() => navigate("/help")}
      aria-label="Help"
      title="How to use PitchRank"
      className="fixed top-3 right-3 z-50 w-8 h-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm font-heading font-semibold select-none"
    >
      ?
    </button>
  );
}
