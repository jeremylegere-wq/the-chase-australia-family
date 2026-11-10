# Changelog

## 1.7.3

- Replaced personal family names in the tournament contestant-field example with generic player labels.
- Added a release privacy check to keep the example generic.

Notable changes are recorded here. This is a feature summary, not a complete commit history.

## 1.7.2

- Corrected Head-to-Head rules: the contestant and Chaser now answer the same question on each turn.
- Both answers are locked before either side moves; the board resolves both outcomes together.
- Head-to-Head draws the next unused question as each turn begins, so longer chases do not recycle a short pre-dealt list.
- Removed the separate Chaser question queue from Head-to-Head. Final Chase continues to use separate question sets.
- Normalised older saved question decks to remove missing IDs, duplicate IDs and duplicate prompts, and repaired current-cycle tracking.
- Added regression coverage for shared questions, simultaneous movement, saved-deck repair and no-repeat allocation.

## 1.7.1

- Added question-deck cycle-boundary safeguards and duplicate-prompt filtering.
- Added regression coverage for repeated prompts and question allocation.

## 1.7.0

- Added family tournaments for 2–8 contestants.
- Added automatic round-robin fixtures, three-points-for-a-win standings and playoff progression.
- Added persistent tournament history and championship winners.
- Added automated tournament coverage.

## 1.6.0

- Added contestant profiles, career statistics, achievements, recent match history and the Family Hall of Fame.
- Added duplicate-safe recording of completed matches.

## 1.5.0

- Added selectable presenter styles and Chaser personalities.
- Added context-sensitive commentary and cooperative/competitive match narratives.

## 1.4.0

- Added contestant introductions, broadcast lower-thirds, player spotlights and studio presentation refinements.

## 1.3.0

- Added locally synthesised game-show audio, character reactions and cinematic presentation cues.

## 1.2.0

- Added original pixel-art contestant, Chaser and team sprites.
- Added animated chase-board characters and Final Chase presentation.

## 1.1.0

- Added a match-wide shuffled question deck with no repeats until the eligible pool is exhausted.
- Added the 16-bit visual overhaul and expanded answer reveals.

## 1.0.0

- Packaged the complete two-player game loop, question manager, offline question bank, save/load, accessibility refinements and desktop launchers.
