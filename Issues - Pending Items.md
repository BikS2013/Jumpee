# Issues - Pending Items

## Pending

1. **Deck — three upstream Jumpee documents contradict each other or the source** (found 2026-09-15 while sourcing the deck). The deck's copy was verified against `Sources/main.swift` and `build.sh` rather than against the prose alone. Three claims disagree:

   a. **Architecture.** `README.md` line 147 lists "Apple Silicon (arm64)" under *System requirements*, but line 73 of the same file says every build is a universal binary, and `build.sh` compiles both `arm64` and `x86_64` and merges them with `lipo`. The source wins — the release is universal. The deck says *"One universal download covers Apple silicon and Intel."* Fix: correct the README's System requirements line.

   b. **Overlay anchor count.** `docs/design/project-functions.md` FR-7 says the position is configurable over "9 anchor points"; `docs/design/configuration-guide.md` lists **7**, and `Sources/main.swift` (the `"top-left" … "center"` switch around line 562) implements exactly those 7 — top-left, top-right, top-centre, bottom-left, bottom-right, bottom-centre and centre. The source and the configuration guide agree; FR-7 is wrong. The deck says *"Seven anchors."* Fix: correct FR-7.

   c. **Pin mechanism.** FR-34 and FR-44 describe pinning as setting the window level through the private `CGSSetWindowLevel` API, and FR-44 says pinned windows are restored to `kCGNormalWindowLevel` on quit. The implementation instead captures the target window with `CGWindowListCreateImage` and displays that image in Jumpee's own floating window (with a `promptForScreenRecording()` fallback when the capture returns nil) — which is exactly why Screen Recording is required, as `configuration-guide.md` correctly states and FR-34 does not. The deck describes the user-visible behaviour and the Screen Recording requirement and does not name an API. Fix: bring FR-34/FR-44 in line with the implementation, or confirm the source is right and rewrite the requirements.

   These only affect documentation accuracy — the app itself is consistent. They matter because the next deck or guide built from the prose alone will repeat the error. Note that FR-34's subject overlaps `v1.9.0: visual workspace popover` (4aedcaa), so the window-management requirements are worth re-reading alongside that release rather than patching in isolation.

## Completed

1. **Deck — committed and published to GitHub Pages** (resolved 2026-09-15). The deck lives on the orphan `deck` branch of `BikS2013/Jumpee` and is published at **<https://biks2013.github.io/Jumpee/>**. The branch carries the slide sources, the six generated photographs and their generator scripts, the built HTML and PDF, the rebuild script, and the verification screenshots.

   Two commits: `84b8240` (the deck) and `ff5b303` (the publishing pipeline, vendoring the nbg-design scripts under `deck/tools/nbg-design/` so the runner can rebuild without the plugin — refresh with `deck/tools/sync-nbg-design.sh`).

   `main` points at the site from its README (`7d389d6`).

2. **Pages — enabled and the deploy branch policy fixed** (resolved 2026-09-15). Two repository settings were needed, both applied:

   - Pages had never been enabled. Enabled with **Source = GitHub Actions** (`POST /repos/BikS2013/Jumpee/pages`, `build_type=workflow`); the site URL is derived from the repository name.
   - The auto-created `github-pages` environment allowed deployments from `main` only, so the first run's **build job succeeded but the deploy job failed** with *"Branch `deck` is not allowed to deploy to github-pages due to environment protection rules."* Adding a deployment branch policy for `deck` fixed it, and the re-run deployed successfully.

   Verified after publication: HTTP 200, 4,261,006 bytes, the expected `<title>`, 30 slides, 36 embedded images and zero unresolved `{{TOKEN}}` placeholders in the served HTML.

   The workflow's actions were then bumped off the deprecated Node 20 runner to the current majors (checkout v5, setup-node v5, configure-pages v6, upload-pages-artifact v4, deploy-pages v5) and re-verified with a live deploy. One deprecation notice remains, from `actions/upload-artifact` pulled in transitively by `upload-pages-artifact`; it is not pinnable from this repository and needs no action here.
