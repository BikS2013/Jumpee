#!/usr/bin/env node
// NBG Design — compatibility wrapper. The in-deck menu grew beyond PDF export (in-place text
// editing, "Save edited copy"), so the injector is now add-deck-menu.mjs. This name keeps
// existing pipelines working; it runs the same CLI (same flags: -o, --remove) and injects the
// current menu. Prefer add-deck-menu.mjs in new workflows.
import { main } from './add-deck-menu.mjs';

console.error('add-pdf-menu.mjs is now add-deck-menu.mjs (menu: Edit text / Export to PDF / Save edited copy) — running it.');
main();
