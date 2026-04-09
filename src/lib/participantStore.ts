// Participant state persisted in localStorage
export interface ParticipantData {
  id: string;
  name: string;
  teamId: string | null;
  isObserver: boolean;
  sessionId: string;
  sessionName: string;
}

const STORAGE_KEY = "participant_data";

export function getParticipant(): ParticipantData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setParticipant(data: ParticipantData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearParticipant() {
  localStorage.removeItem(STORAGE_KEY);
}
