import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { ParticipantVoteSummary } from "@/lib/participantVotes";
import {
  buildEditableScores,
  hasScoreChanges,
  isEditedVoteValid,
  setScoreAt,
} from "@/lib/voteEditing";

export interface MyVotesListProps {
  summaries: ParticipantVoteSummary[];
  editable?: boolean;
  onSaveVote?: (voteId: string, criteriaScores: number[]) => Promise<boolean>;
}

export function MyVotesList({ summaries, editable = false, onSaveVote }: MyVotesListProps) {
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);
  const [draftScores, setDraftScores] = useState<Array<number | null>>([]);
  const [saving, setSaving] = useState(false);

  const startEditing = (summary: ParticipantVoteSummary) => {
    setEditingVoteId(summary.voteId);
    setDraftScores(buildEditableScores(summary));
  };

  const cancelEditing = () => {
    setEditingVoteId(null);
    setDraftScores([]);
  };

  const saveEditing = async (summary: ParticipantVoteSummary) => {
    if (!onSaveVote || !isEditedVoteValid(draftScores)) return;

    if (!hasScoreChanges(buildEditableScores(summary), draftScores)) {
      cancelEditing();
      return;
    }

    setSaving(true);
    const ok = await onSaveVote(summary.voteId, draftScores as number[]);
    setSaving(false);
    if (ok) cancelEditing();
  };

  if (summaries.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">You have not submitted any votes yet.</Card>
    );
  }

  return (
    <>
      {summaries.map((vote) => {
        const isEditing = editingVoteId === vote.voteId;
        const draftTotal = draftScores.reduce<number>((sum, score) => sum + (score ?? 0), 0);

        return (
          <Card key={vote.voteId} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold">{vote.teamName}</h4>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">
                  {isEditing ? draftTotal : vote.totalScore} pts
                </span>
                {editable && !isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label={`Edit vote for ${vote.teamName}`}
                    onClick={() => startEditing(vote)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                {vote.criteriaScores.map((item, criteriaIndex) => (
                  <div key={`${vote.voteId}-${item.label}`} className="space-y-1.5">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-label={`${item.label} ${value}`}
                          aria-pressed={draftScores[criteriaIndex] === value}
                          disabled={saving}
                          onClick={() =>
                            setDraftScores((prev) => setScoreAt(prev, criteriaIndex, value))
                          }
                          className={cn(
                            "h-9 rounded-lg border text-sm font-semibold transition-all",
                            draftScores[criteriaIndex] === value
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={saving || !isEditedVoteValid(draftScores)}
                    onClick={() => void saveEditing(vote)}
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={cancelEditing}
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {vote.criteriaScores.map((item) => (
                  <div
                    key={`${vote.voteId}-${item.label}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.score}/5</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}

export interface MyVotesDrawerProps extends MyVotesListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
}

export function MyVotesDrawer({
  open,
  onOpenChange,
  trigger,
  summaries,
  editable = false,
  onSaveVote,
}: MyVotesDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="max-h-[82vh]">
        <DrawerHeader>
          <DrawerTitle>My Submitted Votes</DrawerTitle>
          <DrawerDescription>
            {editable
              ? "These are only your own ratings. Tap the pencil to change a vote."
              : "These are only your own ratings. Voting is closed, so votes are final."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto space-y-3">
          <MyVotesList summaries={summaries} editable={editable} onSaveVote={onSaveVote} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
