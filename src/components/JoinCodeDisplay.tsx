import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface JoinCodeDisplayProps {
  code: string;
  size?: "sm" | "lg";
  showCopyButton?: boolean;
  className?: string;
}

export function JoinCodeDisplay({ code, size = "sm", showCopyButton = false, className }: JoinCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (size === "lg") {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="bg-primary/10 rounded-2xl px-8 py-6 border-2 border-primary/20">
          <span className="font-heading text-4xl font-bold tracking-[0.3em] text-primary">
            {code}
          </span>
        </div>
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy code"}
          </button>
        )}
      </div>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 bg-primary/10 text-primary font-heading font-semibold text-sm px-3 py-1 rounded-lg tracking-wider",
      className
    )}>
      {code}
      {showCopyButton && (
        <button onClick={handleCopy} className="hover:text-primary/70 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </span>
  );
}
