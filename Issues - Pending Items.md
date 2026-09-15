# Issues - Pending Items

## Pending

1. **Deck — three upstream Jumpee documents contradict each other or the source** (found 2026-09-15 while sourcing the deck). The deck's copy was verified against `Sources/main.swift` and `build.sh` rather than against the prose alone. Three claims disagree:

   a. **Architecture.** `README.md` line 147 lists "Apple Silicon (arm64)" under *System requirements*, but line 73 of the same file says every build is a universal binary, and `build.sh` compiles both `arm64` and `x86_64` and merges them with `lipo`. The source wins — the release is universal. The deck says *"One universal download covers Apple silicon and Intel."* Fix: correct the README's System requirements line.

   b. **Overlay anchor count.** `docs/design/project-functions.md` FR-7 says the position is configurable over "9 anchor points"; `docs/design/configuration-guide.md` lists **7**, and `Sources/main.swift` (the `"top-left" … "center"` switch around line 562) implements exactly those 7 — top-left, top-right, top-centre, bottom-left, bottom-right, bottom-centre and centre. The source and the configuration guide agree; FR-7 is wrong. The deck says *"Seven anchors."* Fix: correct FR-7.

   c. **Pin mechanism.** FR-34 and FR-44 describe pinning as setting the window level through the private `CGSSetWindowLevel` API, and FR-44 says pinned windows are restored to `kCGNormalWindowLevel` on quit. The implementation instead captures the target window with `CGWindowListCreateImage` and displays that image in Jumpee's own floating window (with a `promptForScreenRecording()` fallback when the capture returns nil) — which is exactly why Screen Recording is required, as `configuration-guide.md` correctly states and FR-34 does not. The deck describes the user-visible behaviour and the Screen Recording requirement and does not name an API. Fix: bring FR-34/FR-44 in line with the implementation, or confirm the source is right and rewrite the requirements.

   These only affect documentation accuracy — the app itself is consistent. They matter because the next deck or guide built from the prose alone will repeat the error.

2. **Deck — nothing is committed yet.** The worktree sits on an orphan `deck` branch with no commits at all, so every deck file is currently untracked. Commit once the deck is approved.

## Completed

*Nothing yet.*
