import type { Game } from "../domain/model";
export const games: Game[] = [
  {
    id: "memory",
    name: "Memory Sequence",
    category: "Memory",
    description: "A little focus. A longer sequence.",
    instructions:
      "Watch the illuminated tiles, then repeat their order. Each successful round adds one tile. A mistake ends the session; complete six rounds to finish.",
    minutes: 2,
    symbol: "▦",
  },
  {
    id: "math",
    name: "Quick Math",
    category: "Math",
    description: "Find your rhythm with numbers.",
    instructions:
      "Solve ten arithmetic questions. Type an integer and press Enter. Accuracy earns points; correct answers earn a small speed bonus. The time limit depends on difficulty.",
    minutes: 1,
    symbol: "±",
  },
  {
    id: "reaction",
    name: "Reaction Test",
    category: "Reaction",
    description: "Wait for the signal. Make your move.",
    instructions:
      "Wait until the panel says GO, then tap or press Space. Complete five valid rounds. Early taps are false starts and do not count as reaction times. Easy uses a shorter waiting window; Hard uses a longer, less predictable window. Browser, display and input hardware affect measurements.",
    minutes: 1,
    symbol: "ϟ",
  },
  {
    id: "logic",
    name: "Pattern Logic",
    category: "Logic",
    description: "Spot the rule behind the pattern.",
    instructions:
      "Solve eight patterns. Choose the next value. Each puzzle explains its rule after you answer. There is exactly one correct option.",
    minutes: 2,
    symbol: "◇",
  },
  {
    id: "focus",
    name: "Focus Finder",
    category: "Attention",
    description: "Find what matters. Filter the rest.",
    instructions:
      "Find every A in the letter grid. Select each tile once. Incorrect selections count against accuracy. Find all targets in three grids.",
    minutes: 1,
    symbol: "⌖",
  },
  {
    id: "numbers",
    name: "Number Memory",
    category: "Memory",
    description: "How many digits can you hold?",
    instructions:
      "Memorize the displayed number. When it disappears, type it exactly, including leading zeros. Five rounds get progressively longer. A mistake ends the session.",
    minutes: 2,
    symbol: "09",
  },
  {
    id: "words",
    name: "Word Scramble",
    category: "Language",
    description: "Give familiar letters a new order.",
    instructions:
      "Unscramble eight words. A hint reveals the first letter. Easy supplies a free first-letter hint. Requested hints reduce points. Skip reveals the answer and counts as incorrect.",
    minutes: 2,
    symbol: "Aa",
  },
  {
    id: "spatial",
    name: "Spatial Rotation",
    category: "Spatial",
    description: "See things from another angle.",
    instructions:
      "Rotate the asymmetric shape clockwise by the shown angle. Choose the matching grid. Eight rounds; reflections are never correct.",
    minutes: 2,
    symbol: "◩",
  },
  {
    id: "nback",
    name: "N-Back Lite",
    category: "Memory",
    description: "Keep the recent past in mind.",
    instructions:
      "For each letter, answer whether it matches the letter one step back (Easy/Normal) or two steps back (Hard). The opening letters establish the sequence. Complete sixteen comparisons.",
    minutes: 2,
    symbol: "↶",
  },
  {
    id: "color",
    name: "Color & Word",
    category: "Attention",
    description: "Read the color, resist the word.",
    instructions:
      "Choose the INK COLOR, ignoring the written word. The color name is also available as accessible text. Complete twelve rounds.",
    minutes: 1,
    symbol: "◉",
  },
  {
    id: "sequence",
    name: "Sequence Builder",
    category: "Logic",
    description: "Make the next connection.",
    instructions:
      "Complete eight arithmetic, geometric or alternating sequences. Choose the next number and read the rule after each answer.",
    minutes: 2,
    symbol: "⋯",
  },
];
export const coreIds = games.slice(0, 5).map((g) => g.id);
export const getGame = (id: string) => games.find((g) => g.id === id)!;
