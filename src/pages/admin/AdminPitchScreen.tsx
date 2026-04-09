import { useState } from "react";
import { motion } from "framer-motion";
import { Timer, Lock, ArrowRight, CheckCircle2, Clock, Search, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AdminSessionLayout } from "@/components/AdminSessionLayout";
import { cn } from "@/lib/utils";

// Mock data — will be replaced by Supabase props
const MOCK_TEAMS = [
  "Team Alpha", "Team Beta", "Team Gamma", "Team Delta",
  "Team Epsilon", "Team Zeta", "Team Eta", "Team Theta",
  "Team Iota", "Team Kappa", "Team Lambda", "Team Mu",
];

const MOCK_VOTERS = [
  { name: "Mehdi", team: "Team Alpha", voted: true },
  { name: "Sarah", team: "Team Beta", voted: true },
  { name: "Alex", team: "Team Gamma", voted: true },
  { name: "Jordan", team: "Team Alpha", voted: false },
  { name: "Priya", team: "Team Beta", voted: true },
  { name: "Lucas", team: "Observer", voted: false },
  { name: "Emma", team: "Team Gamma", voted: true },
  { name: "Yuki", team: "Team Alpha", voted: false },
  { name: "Daniel", team: "Team Delta", voted: true },
  { name: "Sophie", team: "Team Epsilon", voted: true },
  { name: "Carlos", team: "Team Zeta", voted: false },
  { name: "Aisha", team: "Team Eta", voted: true },
  { name: "Tomoko", team: "Team Theta", voted: true },
  { name: "David", team: "Team Iota", voted: false },
  { name: "Lena", team: "Team Kappa", voted: true },
  { name: "James", team: "Team Lambda", voted: true },
  { name: "Nina", team: "Team Mu", voted: false },
  { name: "Omar", team: "Observer", voted: true },
  { name: "Fatima", team: "Team Alpha", voted: true },
  { name: "Chen", team: "Team Beta", voted: true },
  { name: "Marie", team: "Team Gamma", voted: true },
  { name: "Ivan", team: "Team Delta", voted: false },
  { name: "Grace", team: "Observer", voted: true },
  { name: "Hugo", team: "Team Epsilon", voted: true },
];

const CURRENT_TEAM_INDEX = 2;

// Steps for the pitch flow
const STEPS = [
  {
    key: "start",
    label: "Start Pitch",
    icon: Timer,
    helper: "Signals participants that this team's pitch has begun.",
  },
  {
    key: "timer",
    label: "Trigger 1-min Timer",
    icon: Timer,
    helper: "Starts a 60-second countdown on every voter's screen.",
  },
  {
    key: "close",
    label: "Close Voting",
    icon: Lock,
    helper: "Locks the voting form — no more votes for this team.",
  },
  {
    key: "next",
    label: "Next Team →",
    icon: ArrowRight,
    helper: "Advances to the next team and resets the voting flow.",
  },
] as const;

export default function AdminPitchScreen() {
  const [activeStep] = useState(0); // Mock: first step is active
  const [selectedTeam, setSelectedTeam] = useState(CURRENT_TEAM_INDEX);
  const [statsOpen, setStatsOpen] = useState(false);

  const votedCount = MOCK_VOTERS.filter((v) => v.voted).length;
  const totalVoters = MOCK_VOTERS.length;
  const percentage = Math.round((votedCount / totalVoters) * 100);

  // Sort: pending first
  const sortedVoters = [...MOCK_VOTERS].sort((a, b) => Number(a.voted) - Number(b.voted));

  return (
    <AdminSessionLayout status="active" isLive>
      <div className="space-y-5">
        {/* Section 1 — Current Pitch Status */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Pitch {selectedTeam + 1} of {MOCK_TEAMS.length}
          </p>
          <h2 className="font-heading text-2xl font-bold">{MOCK_TEAMS[selectedTeam]}</h2>
        </div>

        {/* Section 5 — Team Selector (horizontal pills) */}
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {MOCK_TEAMS.map((team, i) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(i)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  i === selectedTeam
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
                )}
              >
                {team}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Only advance to a team once their pitch has started.
          </p>
        </div>

        {/* Section 2 — Action Buttons */}
        <Card className="p-4 space-y-3">
          <h3 className="font-heading text-sm font-semibold">Pitch flow</h3>
          <div className="space-y-2">
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isDone = i < activeStep;
              const isFuture = i > activeStep;

              return (
                <div key={step.key} className="space-y-0.5">
                  <Button
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "w-full h-11 justify-start gap-2 text-sm",
                      isDone && "bg-success/10 border-success/30 text-success hover:bg-success/15",
                      isFuture && "opacity-40"
                    )}
                    disabled={isFuture}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                    {step.label}
                  </Button>
                  <p className="text-[10px] text-muted-foreground pl-1">{step.helper}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Section 3 — Voter Tracking */}
        <Card className="p-4 space-y-4">
          <h3 className="font-heading text-sm font-semibold">Voter status</h3>

          {/* Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                Voted: {votedCount} / {totalVoters}
              </span>
              <span className="text-muted-foreground text-xs">
                Not yet: {totalVoters - votedCount}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
            <p className="text-[10px] text-muted-foreground text-right">{percentage}%</p>
          </div>

          {/* Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Filter by name..." className="h-9 pl-9 text-xs bg-background" />
          </div>

          {/* Voter list */}
          <div className="max-h-[300px] overflow-y-auto space-y-1.5 -mx-1 px-1">
            {sortedVoters.map((voter, i) => (
              <motion.div
                key={voter.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-primary">
                      {voter.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-tight">{voter.name}</p>
                    <p className="text-[10px] text-muted-foreground">{voter.team}</p>
                  </div>
                </div>
                {voter.voted ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Section 4 — Session Stats (collapsible) */}
        <Card className="overflow-hidden">
          <button
            onClick={() => setStatsOpen(!statsOpen)}
            className="w-full flex items-center justify-between p-4 text-sm font-semibold font-heading hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Session stats
            </span>
            {statsOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {statsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="px-4 pb-4"
            >
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total votes cast", value: "54" },
                  { label: "Avg votes / pitch", value: "18" },
                  { label: "Pitches completed", value: "2 / 12" },
                  { label: "Participation rate", value: "75%" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-muted/50 rounded-lg p-3 text-center"
                  >
                    <p className="text-lg font-heading font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </Card>
      </div>
    </AdminSessionLayout>
  );
}
