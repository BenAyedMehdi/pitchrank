import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ParticipantVoteSummary } from "@/lib/participantVotes";
import { MyVotesList } from "./MyVotesDrawer";

const summaries: ParticipantVoteSummary[] = [
  {
    voteId: "vote-1",
    teamId: "team-1",
    teamName: "Alpha",
    pitchOrder: 0,
    submittedAt: "2026-04-13T10:00:00.000Z",
    totalScore: 9,
    criteriaScores: [
      { label: "Tech", score: 4 },
      { label: "Pitch", score: 5 },
    ],
  },
];

describe("MyVotesList", () => {
  it("shows an empty state when there are no votes", () => {
    render(<MyVotesList summaries={[]} />);
    expect(screen.getByText("You have not submitted any votes yet.")).toBeInTheDocument();
  });

  it("renders read-only scores without an edit button when not editable", () => {
    render(<MyVotesList summaries={summaries} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit vote for Alpha")).not.toBeInTheDocument();
  });

  it("opens the inline editor from the pencil button and saves updated scores", async () => {
    const onSaveVote = vi.fn().mockResolvedValue(true);
    render(<MyVotesList summaries={summaries} editable onSaveVote={onSaveVote} />);

    fireEvent.click(screen.getByLabelText("Edit vote for Alpha"));

    expect(screen.getByLabelText("Tech 4")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByLabelText("Tech 2"));
    expect(screen.getByText("7 pts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSaveVote).toHaveBeenCalledWith("vote-1", [2, 5]));
    await waitFor(() =>
      expect(screen.getByLabelText("Edit vote for Alpha")).toBeInTheDocument(),
    );
  });

  it("cancels editing without saving", () => {
    const onSaveVote = vi.fn();
    render(<MyVotesList summaries={summaries} editable onSaveVote={onSaveVote} />);

    fireEvent.click(screen.getByLabelText("Edit vote for Alpha"));
    fireEvent.click(screen.getByLabelText("Tech 1"));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onSaveVote).not.toHaveBeenCalled();
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("does not call the save handler when nothing changed", async () => {
    const onSaveVote = vi.fn().mockResolvedValue(true);
    render(<MyVotesList summaries={summaries} editable onSaveVote={onSaveVote} />);

    fireEvent.click(screen.getByLabelText("Edit vote for Alpha"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(screen.getByText("4/5")).toBeInTheDocument());
    expect(onSaveVote).not.toHaveBeenCalled();
  });

  it("keeps the editor open when saving fails", async () => {
    const onSaveVote = vi.fn().mockResolvedValue(false);
    render(<MyVotesList summaries={summaries} editable onSaveVote={onSaveVote} />);

    fireEvent.click(screen.getByLabelText("Edit vote for Alpha"));
    fireEvent.click(screen.getByLabelText("Pitch 1"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSaveVote).toHaveBeenCalledWith("vote-1", [4, 1]));
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
