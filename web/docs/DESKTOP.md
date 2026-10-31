# Nightmare Carnival for Windows (desktop client)

The Windows app is a thin, locked-down [Electron](https://www.electronjs.org/) shell (`web/desktop/`)
around the **hosted** game at https://nightmare-carnival.netlify.app. It plays exactly the build the
browser plays, so desktop and browser players share one game, one co-op ecosystem and one deploy.

## How it fits together

```
 ordinary game change ─► npm run deploy -- --deploy ─► Netlify ─► version.json says "new build"
                                                                 │
          browser players ◄──────────── "Restart & Update" (at a safe moment) ─────────► desktop players
                                                                                          (reload, no installer)

 change to the shell itself ─► tag vX.Y.Z ─► GitHub Actions builds the installer ─► draft GitHub Release
                                                                                          │ (publish it)
                                       installed apps download it in the background ◄─────┘
                                       and install it when the game says it's safe (or on quit)
```

- **Game updates** (almost everything) need no new installer: the app loads the hosted page; the page polls
  `version.json` and offers *Restart & Update* only at a safe moment (see "Update safety" below).
- **Shell updates** (this folder changes: Electron version, window behaviour, security settings) go out as a
  new installer through GitHub Releases; `electron-updater` downloads it in the background and installs it
  when the player restarts from the in-game prompt, or the next time they quit.

## Files

| File | What it does |
|---|---|
| `main.js` | the main process: window, security, navigation lock, permissions, fullscreen, window state, close confirmation, offline/crash page, the IPC bridge's handlers, shell updates |
| `preload.js` | the bridge the page sees as `window.ncDesktop` (a handful of validated calls; no Node, no files) |
| `shell/offline.html` | shown when the hosted game can't be reached or the page crashes: retries on its own every 15 s |
| `build/icon.png` | the app icon (512×512, made from the game's favicon and marquee by `tools/make-icon.js`) |
| `bench.js` | the benchmark runner used by the engineering optimization pass (development only; not packaged) |
| `package.json` | Electron 44.9.3, electron-builder 26.17.0, electron-updater 6.8.10 (exact versions) and the installer config |

The game side lives in `web/src/platform/` (`desktop.ts`: the bridge's types; `updates.ts`: version checks)
and `web/src/ui/updatePrompt.ts`.

## Running and building

```bash
cd web/desktop
npm ci                  # once
npm start               # the shell around the hosted game (production URL)
npm run start:dev       # around the local dev server (npm run dev in web/), with developer tools
npm run dist            # build the Windows installer into web/desktop/release/
```

`npm run dist` produces `release/Nightmare-Carnival-Setup-<version>.exe` (NSIS, per-user, no admin rights),
`latest.yml` and a `.blockmap` (the update metadata), and `release/win-unpacked/` (the app without installing).

Only a local dev server may stand in for the hosted game: `--game-url=http://127.0.0.1:<port>/` or
`NC_GAME_URL` (anything else is ignored and logged).

## Installing (players)

Run `Nightmare-Carnival-Setup-<version>.exe`. It installs for the current user (no administrator prompt),
adds a desktop and a Start Menu shortcut and launches the game. Uninstall from *Settings → Apps* (saves are
kept in the user's profile unless they delete `%APPDATA%\Nightmare Carnival`).

The installer is **not code-signed** yet, so Windows SmartScreen shows "Windows protected your PC" on first
run: *More info → Run anyway*. See "Remaining setup".

## Controls and window

- **F11** or **Alt+Enter**: fullscreen / windowed (the choice, size and position are remembered).
- Keyboard, mouse and controllers work as in the browser (Chromium's Gamepad API).
- Closing the window during a night or a lobby asks first ("Leave in the middle of the night?").
- During a night the display is kept awake (a controller sends no keyboard or mouse input).
- **F12** / **Ctrl+Shift+I** open the developer tools only in a development shell or with `--devtools`.

## Security

Following Electron's security checklist:

- The page runs with `contextIsolation`, `sandbox` (app-wide `app.enableSandbox()`), no Node integration,
  `webSecurity` on, no insecure content, no `<webview>`, no navigation on drag-and-drop.
- Navigation and redirects are pinned to the game's origin (and the bundled offline page); other `https`
  links open in the default browser; nothing else (no other schemes, no files) is ever opened.
- No new windows: `setWindowOpenHandler` denies all (links go to the browser).
- Permissions: only `fullscreen` and `clipboard-sanitized-write` (copying a lobby code), and only for the
  game's origin; camera, microphone, location, notifications, HID/serial/USB are denied.
- The bridge exposes fixed calls with checked arguments; every IPC handler re-checks that the sender is the
  game's origin (or the offline page).
- Electron fuses (set at packaging): `RunAsNode` off, `NODE_OPTIONS` and `--inspect` off, cookie encryption
  on, ASAR integrity validation on, load only from the ASAR, no extra file-protocol privileges.
- Shell updates come from this repository's GitHub Releases over HTTPS; electron-updater checks each
  download's SHA-512 against `latest.yml`. (Signature verification needs a code-signing certificate.)
- No tokens or secrets are embedded: the releases are public downloads; publishing uses the CI's own
  `GITHUB_TOKEN`.

## Update safety

The page tells the shell what it's doing (`ncDesktop.setSession(state, safe)`): `menu`, `hub` (the Midway
alone) and `results` are safe; `match` (any night in progress), `lobby` and Midway with a party, `connecting`
and `reconnecting` are not.

- A game update found during a match is remembered and offered after it ends; the card never blocks play
  and never restarts by itself. *Later* puts it away for 30 minutes.
- *Restart & Update* checks the server first (offline: it says so and stays put), writes the save, leaves any
  party politely, then reloads the latest build (the shell clears its cache). The new page confirms it got
  the build it expected and says "Updated to version …" (or, after a CDN lag, that it will offer it again).
- A shell update downloads in the background at any time but installs only from the prompt at a safe
  moment (the shell refuses an install request while the game reports an unsafe state) or on quit.
- Co-op refuses mixed builds: the protocol number and a fingerprint of the simulation code must match, and
  the refusal says which side should update.

## Releasing a new shell version

1. Change `web/desktop/` and bump `version` in `web/desktop/package.json` (e.g. `0.1.1`).
2. Commit, then `git tag v0.1.1 && git push origin v0.1.1`.
3. The **desktop release** workflow (`.github/workflows/desktop-release.yml`) builds the installer on
   Windows and attaches it, `latest.yml` and the blockmap to a **draft** release `v0.1.1`.
4. Download the draft's installer, check it, then **publish** the release. Installed apps find it within
   ~4 hours (they check 20 s after launch and every 4 hours).
5. For the website's download button, set `web/desktop-release.json` to
   `{ "windows": { "version": "0.1.1", "url": "https://github.com/kschwarz48/nightmare-carnival/releases/download/v0.1.1/Nightmare-Carnival-Setup-0.1.1.exe" } }`
   and deploy the web game: the title screen then shows **Download for Windows** (browsers only).

## Remaining setup

- **Code signing** (recommended before sharing beyond family): buy an OV/EV code-signing certificate (or use
  Azure Trusted Signing), add it as CI secrets (`CSC_LINK` / `CSC_KEY_PASSWORD`, or the Azure variables) and
  electron-builder signs automatically. This removes the SmartScreen warning and lets electron-updater
  verify the publisher of each update.
- **First release**: tag `v0.1.0` (or run the workflow by hand with "publish"), check and publish the draft,
  then fill in `desktop-release.json` as above.
- **Private distribution**: the repository is public, so releases are public downloads. For a private beta,
  move releases to a private bucket (electron-updater's `generic` or `s3` provider) — do not embed a GitHub
  token in the app.
