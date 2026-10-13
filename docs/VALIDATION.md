# Validation record — 2026-10-12

This file records what was actually checked; launchers being present does not imply every platform has been tested.

## Completed checks

- JavaScript syntax checks for custom startup/UI modules.
- Bash syntax checks for macOS/Linux launchers.
- 12 theme test groups: defaults, input limits, day/night schedules (including midnight boundaries), system-mode selection, versioned import/export, credential-field exclusion, invalid data handling.
- Full application source presence and first-run default settings checks.
- Privacy audit against local live credentials (not included in the audit output or source), private absolute paths, runtime data, and personal files.

## Platform scope

- macOS ARM64 is the local verification platform.
- Windows and Linux launcher files are supplied, but neither OS was available for native execution during packaging.
- This archive excludes Node.js and installed node_modules; those are prerequisites / installed dependencies, not missing application source.

## Integration test

- A clean `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` completed successfully (667 packages).
- Launched through studio-launcher.mjs with an empty, separate test data directory and loopback port 8011. The existing user service on 8000 was not replaced.
- Webpack compiled successfully and the complete server started.
- First launch showed the custom QQ layout without installing a separate patch or requiring the upstream onboarding modal. A neutral User identity is supplied and can be changed in My Identity.
- All 12 categorized settings pages opened successfully.
- Changed a theme, verified it on disk, reloaded the page, and verified the selection persisted; restored blue defaults afterward.
- Final verification used localhost rather than 127.0.0.1 to isolate cookies from another local instance. An initial cross-port cookie collision produced CSRF errors; after host isolation, the save/reload test passed and no new frontend error logs were observed. CSRF protection was not disabled.
- No actual model generation was requested. Users supply their own API/model connection.
- No private user chats, credentials, avatars or background images are included in the release screenshots.
