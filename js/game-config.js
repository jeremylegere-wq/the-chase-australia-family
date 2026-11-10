/* M1: central configuration and defaults. Gameplay rules are added in later milestones. */
window.ChaseGame = window.ChaseGame || {};
window.ChaseGame.config = {
  appName: "The Chase Australia: Family Edition",
  version: "1.2.0",
  modes: {
    cooperative: { label: "Cooperative", description: "Two contestants work as one team.", teamPlay: true },
    competitive: { label: "Competitive", description: "Two contestants compete independently.", teamPlay: false }
  },
  difficulty: {
    junior: { label: "Junior", ageHint: "Ages 7–9" },
    family: { label: "Family", ageHint: "Mixed knowledge" },
    challenge: { label: "Challenge", ageHint: "Tricky questions" }
  },
  chaser: {
    easy: { label: "Easy", strength: "More forgiving" },
    medium: { label: "Medium", strength: "Balanced" },
    hard: { label: "Hard", strength: "Tough opponent" }
  },
  defaults: {
    mode: "cooperative",
    players: ["Player 1", "Player 2"],
    difficulty: "family",
    chaser: "medium",
    categories: "mixed",
    length: "standard"
  }
};
