import { motion } from "framer-motion";
import { Users, Clock } from "lucide-react";
import { AdminNav } from "@/components/AdminNav";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";
import { SessionStatusBadge } from "@/components/SessionStatusBadge";

// TODO: Add QR code display using session join URL for easy mobile scanning

const MOCK_PARTICIPANTS = [
  { name: "Mehdi", team: "Team Alpha", time: "2 min ago" },
  { name: "Sarah", team: "Team Beta", time: "3 min ago" },
  { name: "Alex", team: "Team Gamma", time: "4 min ago" },
  { name: "Jordan", team: "Team Alpha", time: "5 min ago" },
  { name: "Priya", team: "Team Beta", time: "5 min ago" },
  { name: "Lucas", team: "Observer", time: "6 min ago" },
  { name: "Emma", team: "Team Gamma", time: "7 min ago" },
  { name: "Yuki", team: "Team Alpha", time: "8 min ago" },
];

export default function AdminLobbyScreen() {
  return (
    <div className="min-h-screen px-4 pb-8">
      <div className="max-w-[480px] mx-auto">
        <AdminNav title="IT Hub Hackathon 2025" backTo="/admin/sessions/1/setup" />

        <div className="space-y-6 mt-2">
          <div className="flex items-center gap-2">
            <SessionStatusBadge status="active" />
          </div>

          {/* Join code display */}
          <div className="flex flex-col items-center gap-2 py-4">
            <JoinCodeDisplay code="HACK24" size="lg" showCopyButton />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Ask participants to open the app and enter this code
            </p>
          </div>

          {/* Participant count */}
          <div className="flex items-center gap-2 px-1">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Participants joined: {MOCK_PARTICIPANTS.length}
            </span>
          </div>

          {/* Participant list */}
          <div className="space-y-2">
            {MOCK_PARTICIPANTS.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between bg-card rounded-xl border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">
                      {p.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.team}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" /> {p.time}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
