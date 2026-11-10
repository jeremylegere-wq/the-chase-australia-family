# Contributing

Thanks for considering a contribution.

## Project principles

- Keep the game playable offline as a static browser application.
- Do not add runtime dependencies, remote fonts, analytics, trackers or network calls without discussing the impact first.
- Use original artwork, audio and interface elements. Do not add official broadcast recordings, logos, presenter likenesses or other assets without appropriate rights.
- Preserve cooperative and competitive gameplay, local data compatibility and accessibility.
- Keep the Chaser's probability-based behaviour clearly documented; do not describe it as question-aware AI.
- Treat trivia accuracy and age suitability as important. Include a source or verification note when adding factual questions.

## Development

No build process is required. Use a current Node.js release for automated checks:

```bash
npm test
```

Before opening a pull request:

1. Run the full test suite.
2. Check modified JavaScript with `node --check`.
3. Test the relevant flows in a browser.
4. Check keyboard operation, narrow layouts and reduced-motion behaviour where relevant.
5. Update `CHANGELOG.md` for user-visible changes.
6. Do not commit personal saves, browser data, generated archives or local editor files.

## Pull requests

Describe the user-visible change, implementation approach, tests run and any manual testing still outstanding. Keep changes focused and avoid unrelated formatting churn.
