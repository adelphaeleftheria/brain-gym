export type Difficulty = "Easy" | "Normal" | "Hard";
export type Category =
  | "Memory"
  | "Math"
  | "Reaction"
  | "Logic"
  | "Attention"
  | "Language"
  | "Spatial";
export interface Game {
  id: string;
  name: string;
  category: Category;
  description: string;
  instructions: string;
  minutes: number;
  symbol: string;
}
export interface Session {
  id: string;
  gameId: string;
  category: Category;
  difficulty: Difficulty;
  start: string;
  end: string;
  duration: number;
  rawScore: number;
  score: number;
  accuracy: number;
  attempts: number;
  correct: number;
  status: "completed";
  scoringVersion?: 2;
  dateKey?: string;
  metrics: Record<string, number>;
  workoutId?: string;
}
export interface Profile {
  name: string;
  difficulty: Difficulty;
  duration: number;
  categories: Category[];
  theme: "dark" | "light" | "system";
  sound: boolean;
  volume: number;
  reducedMotion: boolean;
  keyboardHints: boolean;
  autoAdvance: boolean;
  onboarded: boolean;
  reminder: boolean;
}
export interface Workout {
  id: string;
  date: string;
  games: string[];
  sessionIds: string[];
  difficulty: Difficulty;
  completed: boolean;
}
export interface Data {
  version: 1;
  profile: Profile;
  sessions: Session[];
  workouts: Workout[];
  dismissed: string[];
}
export const categories: Category[] = [
  "Memory",
  "Attention",
  "Logic",
  "Math",
  "Reaction",
  "Language",
  "Spatial",
];
export const defaults = (): Data => ({
  version: 1,
  profile: {
    name: "",
    difficulty: "Normal",
    duration: 5,
    categories: [],
    theme: "dark",
    sound: false,
    volume: 0.3,
    reducedMotion: false,
    keyboardHints: true,
    autoAdvance: false,
    onboarded: false,
    reminder: false,
  },
  sessions: [],
  workouts: [],
  dismissed: [],
});
