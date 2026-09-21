# Workflow overview and contextual navigation

Confirmed scope: sidebar serves the current view. Workflows gets an overview landing page, saved workflow navigation and creation. Move run-history/standalone-Codex entry points to overview content. Keep project scope and all saved data; Codex uses its own contextual sidebar. No real executions during verification.

Solo implementation now, authorized by user. TT local:0168CB72-0BD8-465C-B6D7-B6034B02D7E6, SKD-NAV-01.

Acceptance: root/project routes land on overview; flow selection/editor/review/history remain accessible; dirty navigation guarded; Codex sidebar contains its own navigation; overview cards and recent run links stay project-scoped; desktop/mobile and existing browser regressions pass. Activate the local service only without active user runs. Inspect live overview read-only, preserve all histories, and record source commit.

Added user scope: Projects gets a top-level overview and becomes the home page. Project cards open that project’s Workflows overview. All projects and the brand return home with unsaved-change protection. Include both overview screens in desktop/mobile verification.

Completed: nine browser suites passed; both actual localhost overviews visually inspected on desktop and fixture/mobile checks passed. Live read-only traversal recorded zero execution requests and unchanged stored data/history. Static UI active with cache skd-shell-0.5.0-5; no backend restart. See VALIDATION.md for evidence.
