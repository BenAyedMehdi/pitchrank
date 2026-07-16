import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  Crown,
  Eye,
  KeyRound,
  LogIn,
  Megaphone,
  Mic,
  Play,
  PlusCircle,
  Send,
  Share2,
  ShieldCheck,
  Star,
  Timer,
  Trophy,
  UserCircle,
  Users,
} from "lucide-react";

interface Step {
  icon: React.ElementType;
  text: string;
}

const adminSteps: Step[] = [
  { icon: ShieldCheck, text: "Go to /admin and enter the admin password." },
  { icon: PlusCircle, text: "Create a new session — name it and define at least 2 rating criteria." },
  { icon: Users, text: "Add all competing teams (minimum 2 required to activate)." },
  { icon: Share2, text: "Share the 6-character join code with everyone in the room." },
  { icon: Play, text: "Activate the session to lock the team list and allow participants to join." },
  { icon: Mic, text: "In the Pitch tab, start each team's pitch when they're ready to present." },
  { icon: Timer, text: "Trigger the 1-minute voting timer after the team finishes presenting." },
  { icon: Eye, text: "Monitor who has voted in real time — a green tick means all votes are in." },
  { icon: CheckSquare, text: "Close voting, then advance to the next team when ready." },
  { icon: Crown, text: "After all pitches, go to Results and manually select one winner per category." },
  { icon: Megaphone, text: "Click 'Reveal All Results' to broadcast the winners to everyone simultaneously." },
];

const participantSteps: Step[] = [
  { icon: LogIn, text: "Open the app URL on your phone or any device." },
  { icon: KeyRound, text: "Enter the 6-character join code displayed on screen by the admin." },
  { icon: UserCircle, text: "Enter your name and select your team (choose 'Not a participant' if you're an observer)." },
  { icon: Clock, text: "Wait on the lobby screen — the admin will start the first pitch when everyone's ready." },
  { icon: Star, text: "When a pitch begins, rate the presenting team on each criterion from 1 to 5." },
  { icon: Send, text: "Submit your vote before the timer runs out — you can edit it until voting closes." },
  { icon: Mic, text: "Your own team's pitch shows a passive screen — sit back and enjoy!" },
  { icon: Trophy, text: "After all pitches, wait for the admin to reveal the results." },
];

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary transition-colors shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4.5 h-4.5 text-muted-foreground" />
        </button>
        <h1 className="font-heading text-lg font-bold">How to use PitchRank</h1>
      </header>

      <div className="max-w-[860px] mx-auto px-4 py-8 space-y-10">

        {/* Intro */}
        <p className="text-base text-muted-foreground text-center">
          PitchRank is a real-time hackathon judging app. One admin controls the session; participants join via a code and vote on each team's pitch.
        </p>

        {/* Admin section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold text-primary">For Admins</h2>
              <p className="text-sm text-muted-foreground">Running the session from start to finish</p>
            </div>
          </div>

          <div className="space-y-3">
            {adminSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-heading font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <step.icon className="w-5 h-5 text-primary shrink-0" />
                  <p className="text-base leading-snug">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest text-muted-foreground bg-background px-3">
            <span className="bg-background px-3">Participants</span>
          </div>
        </div>

        {/* Participant section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold text-emerald-600">For Participants</h2>
              <p className="text-sm text-muted-foreground">Joining and voting during the event</p>
            </div>
          </div>

          <div className="space-y-3">
            {participantSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-heading font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <step.icon className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-base leading-snug">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground pb-4">
          That's it — enjoy the event! 🎉
        </p>
      </div>
    </div>
  );
}
