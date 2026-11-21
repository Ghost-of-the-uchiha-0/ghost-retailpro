# Repository security check

Add a local command that helps review this repository before public sharing.

## What it will do
- Report tracked `.env`-style files and likely private credentials in tracked files and reachable Git history.
- Show file, line, and finding type only; never print matched secret values.
- Treat findings as review warnings, document how to run the check, and add tests for detection and value redaction.

## Technical details
- Implement as a dependency-free Node script that uses Git to inspect the working tree and available history; this belongs outside the browser app because browsers cannot inspect the user's Git repository.
- Add an npm command, focused Vitest coverage, README instructions, and one architecture note in `AGENTS.md`.