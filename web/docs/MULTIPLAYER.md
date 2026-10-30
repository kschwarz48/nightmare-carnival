# Online Co-op — Two-Player Alpha

Two players, one night, real time, over the internet, with no game server. One browser **hosts**. It runs
the only simulation. The other **joins** with a six-character code and plays the same night.
Matchmaking uses the free PeerJS signalling service. The game traffic itself goes peer-to-peer over
WebRTC data channels.

Design decisions: D-51 (co-op rules), D-52 (netcode), D-53 (party scaling and co-op UX) in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md). Test status: [§6](#6-what-has-been-tested). Do read it:
cross-network play has **not** been verified yet.

**Live alpha:** <https://nightmare-carnival.netlify.app> (Netlify; deployment in [§4](#4-deploying-the-alpha-static-hosting)).

---

## 1. For players

1. Both players open the game's web address: **https://nightmare-carnival.netlify.app** for the alpha (any deploy must be
   HTTPS).
2. **Host:** title screen → **Multiplayer** → enter a name → **Host a Game**. A lobby opens with a
   code like `K7M2QP`. **Copy** it and send it to your friend.
3. **Guest:** **Multiplayer** → name → **Join a Game** → type the code → **Join**.
4. Each player picks a character; each character can be taken by only one player. Then press **Ready!**
   The host chooses the difficulty and pulls **Start the Night!** once both are ready.

The rules follow Vampire Survivors co-op:

| | |
|---|---|
| Experience | **Shared.** Either player's tickets fill one bar and level the whole party. |
| Level-ups | Each player drafts **their own** card. The night stays frozen until **both** have chosen. A "Waiting for …" note shows who is still choosing. |
| Builds | **Independent.** An item one player owns never appears in the other's draft. An evolution may use your partner's passive. |
| Slots | 6 weapons + 6 passives solo; **4 + 4 each** with two players (VS: 6 / 4 / 3 / 2). |
| Prize chests | **One wheel, split prizes.** Both players watch the same wheel. Each prize is tagged with its owner's name. The night resumes when both have finished watching. |
| Falling | A player at 0 HP drops into a **coffin**. It opens by itself in 40 s, or in 6 s with the partner standing next to it. The revived player gets back half their health. If both players are down, the night ends. |
| Pause | Either player can pause. It pauses the night for **both**, and the other sees "Paused by …". |
| Rewards | Each player banks **their own** Lost Tickets and achievements into their own save. The Last Song's reward unlocks for both. |
| Difficulty | A duo faces a 25% denser crowd, and enemies and bosses have 30% more health. |

After the night, the host can press **Back to the Lobby** for another round with the same connection.

**F3** toggles the network diagnostics: latency, snapshot rate and size, loss, the connection route,
and prediction error. A small **● NN ms** latency readout is always shown in co-op.

### If something goes wrong

- **"No lobby with that code."** Check the code. The host must keep the lobby open: closing that tab
  closes the lobby.
- **Guest refreshes or drops mid-night.** The host's night pauses for up to 20 s with "…lost connection —
  waiting for them to rejoin" and a **Carry on alone** button. The guest rejoins the same seat by
  joining with the same code from the same tab.
- **The host leaves.** The night ends, and the guest sees "The host ended the night." There is no host
  migration in the alpha.
- **"Could not open a direct connection…"** A firewall or strict NAT blocks peer-to-peer traffic.
  A TURN relay is needed; see §3.

---

## 2. How it works (D-52)

```
HOST browser                                             GUEST browser
┌────────────────────────────┐   reliable, ordered      ┌───────────────────────────┐
│ Game (authoritative, 60 Hz)│◄── JSON: hello, pick,  ──│ GuestSession              │
│  inputs[1] ◄─ jitter buffer│    ready, draft, pause,  │  ├─ Replica → mirror Game │
│ HostSession                │    prize_done, ping      │  │   (never ticked)       │
│  ├─ SnapshotEncoder ───────┼── binary snapshots ─────►│  ├─ prediction (own fool) │
│  │   (delta vs. guest ack) │   unreliable, unordered  │  └─ renderer + HUD (same  │
│  └─ event forwarder ───────┼── JSON events ──────────►│      code as solo)        │
│ renderer + HUD (solo code) │◄── binary inputs ────────│  60 Hz input packets      │
└────────────────────────────┘   (6× redundant)         └───────────────────────────┘
           ▲  PeerJS signalling (WebSocket) only to connect  ▲
           └──────────── 0.peerjs.com / your own server ─────┘
```

- **Authority.** The host runs the one simulation, with both players in it (the D-51 party). The guest
  sends only inputs. The host applies them, one per tick, through a small jitter buffer. Everything the
  guest sees comes from the host.
- **Two channels on one WebRTC connection.** The PeerJS `DataConnection` (raw serialisation, reliable,
  ordered) carries small JSON control messages. Next to it, each side opens a **pre-negotiated,
  unordered, zero-retransmit `RTCDataChannel`** for snapshots and inputs: a late snapshot is worthless,
  so it is never resent and never blocks. If that channel cannot open, binary traffic falls back to
  the reliable connection.
- **Snapshots (20 Hz, delta-compressed).** Every pooled entity is split into parts: static (identity,
  kind, size), motion (position, velocity) and, for enemies, state (flash, wind-up, status). A part is
  sent only while the guest may not have its current bytes, that is, while it changed after the
  newest snapshot the guest has acknowledged. A presence bitmap marks which slots exist, so a ticket
  lying still costs one bit. Bosses send only the JSON keys that changed since the acknowledged
  baseline. Positions are quarter-unit i16 and strings are dictionary ids. A lost snapshot loses
  nothing: unacknowledged parts are simply sent again. Very large snapshots drop the rate to
  15 or 12 Hz, and a congested channel skips a snapshot instead of queueing stale state.
- **Interest management.** Enemies are sent within 1.9× the guest's view, so anything walking in already
  has motion history. Projectiles, bullets, pickups, zones and effects are sent near the view.
  Players, hazards, summons, bosses and the quest are always sent.
- **Guest rendering.** Snapshots are written into a mirror `Game` that is never ticked, so the solo
  renderer, HUD and audio run unchanged. Other entities interpolate between the last two snapshots,
  rendering about one snapshot behind. Hazards extrapolate their own motion. Cosmetic effects and
  positional sounds replay locally.
- **Client-side prediction.** The guest moves its own character immediately, using the same
  `moveBody`/`steer` code as the host (`sim/movement.ts`). Each snapshot reports the last input the host
  applied. The guest resets to the host's position, replays its unacknowledged inputs, and eases any
  difference out over ~120 ms. The host's dash override (bumper surge), pulls and knockback are not
  predicted; they arrive as corrections.
- **Events.** Gameplay events the guest's UI needs (its draft hand, level-ups, banners, boss phases,
  chests, quest cues, pickups and hurts about the guest, the run's end with the guest's own stats)
  travel on the reliable channel. The guest replays them on its mirror's event bus, so the solo UI
  wiring handles them.
- **Holds.** The night freezes for drafts (phase `draft`), pauses, prize wheels and a dropped partner.
  A snapshot flag tells the guest the night is held, so it stops predicting. Inputs that reach a held
  night count as spent.
- **Background tabs.** Browsers stop `requestAnimationFrame` in hidden tabs. A tiny worker clock keeps
  the host's night simulating, and both sides' keepalives flowing, when someone alt-tabs.

### Lobby and security

- Codes are 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no look-alikes), drawn from the
  browser's CSPRNG: 31⁶ ≈ 887 million codes. They map to a namespaced signalling id
  (`nightmare-carnival-v1-CODE`). A taken id is regenerated.
- The first message must be a `hello` with the matching protocol version, or the connection is refused.
  The lobby holds two players: a third connection gets "lobby full". Once a night has started, only the
  original guest can rejoin, using a 128-bit seat token kept in that tab's `sessionStorage`.
- Every incoming message is size-capped, rate-limited and validated field by field:
  - The guest's meta perks are clamped to what a real save could hold.
  - Names are stripped of markup.
  - Draft choices are checked against the guest's real hand.
  - Input movement is clamped to the unit disc.
- Malformed traffic is tolerated a little, then the guest is disconnected. The guest validates host
  messages too, and only whitelisted event types are replayed.
- No anti-cheat beyond that: the alpha trusts its two friends.

### Code map (`web/src/net/`)

| File | Role |
|---|---|
| `codec.ts` | Bounds-checked binary writer/reader (clamping, varints) and the acknowledged string dictionary |
| `snapshot.ts` | Per-part delta encoder (`SnapshotEncoder`), decoder, boss key deltas, interest rings |
| `replica.ts` | Guest mirror: applies deltas slot by slot, interpolation, hazard extrapolation, prediction + reconciliation |
| `protocol.ts` | Message types, validation, rate limiter, binary input packets |
| `session.ts` | `HostSession` / `GuestSession`: lobby, seat tokens, input jitter buffer, snapshots, event forwarding, drafts / prize / pause sync, disconnect and reconnect, diagnostics |
| `link.ts` | `NetLink` transport interface + a deterministic in-memory loopback (latency, jitter, loss, duplication) |
| `peer.ts` | PeerJS/WebRTC transport (lazy-loaded), negotiated datagram channel, ICE route probe, friendly errors |
| `codes.ts`, `config.ts` | Lobby codes and seat tokens; signalling/TURN configuration |

The UI lives in `ui/lobby.ts` (menus, lobby), the co-op layer of `ui/hud.ts`, and the co-op section
of `app.ts`. Sessions speak only to a `NetLink`. Replacing PeerJS with your own signalling server,
a relay or WebSockets means writing one class.

---

## 3. Signalling and TURN

**Defaults (no configuration):** signalling through **PeerJS Cloud** (`0.peerjs.com`, free, shared, no
SLA). ICE uses the PeerJS client's built-in list: Google STUN plus the public PeerJS TURN relays
(best effort).

That reaches most home networks. A **TURN relay** carries traffic when two peers cannot connect
directly: symmetric NAT, some mobile carriers, strict corporate or university firewalls. F3 shows the
route in use:
- `host`: same network
- `srflx` / `prflx`: direct through NAT
- `relay`: through TURN

### Runtime override: `net-config.json`

The build ships an empty `net-config.json` next to `index.html` (from `public/`). Fill it in to
override. It is read when the multiplayer menu opens, so no rebuild is needed (on Netlify, edit
`dist/net-config.json` and redeploy with `--no-build`). See `public/net-config.example.json`:

```json
{
  "peer": { "host": "peer.example.com", "port": 443, "path": "/", "secure": true, "key": "peerjs" },
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": ["turn:turn.example.com:3478", "turns:turn.example.com:5349"], "username": "alpha", "credential": "secret" }
  ],
  "debug": 0
}
```

Every field is optional:
- Omit `peer` to keep PeerJS Cloud.
- `iceServers` *replaces* the default list; include a STUN server too.
- `debug` (0–3) is PeerJS logging.

### Build-time override

You can set these instead, in the environment or `web/.env.local`:
- `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`, `VITE_PEER_KEY`
- `VITE_ICE_SERVERS`: a JSON array of `RTCIceServer`

### Running your own

- **Signalling.** The PeerJS server is a small Node app (`npx peerjs --port 9000 --key peerjs`, or its
  Docker image). It only brokers connections; no game traffic passes through it.
- **TURN.** Self-host [coturn](https://github.com/coturn/coturn), or use a hosted TURN service; several
  have free tiers. Anything in a static `net-config.json` is public. For a wider release, issue
  short-lived TURN credentials from a small endpoint instead of a fixed secret.

---

## 4. Deploying the alpha (static hosting)

```bash
cd web
npm install
npm test          # optional but recommended
npm run build     # → web/dist/ (relative paths; PeerJS is a separate lazy chunk)
```

Serve `dist/` over **HTTPS**: WebRTC needs a secure context, except on `localhost`. Any static host
works:

- **Netlify**: drag `dist/` onto app.netlify.com/drop, or connect the repo with build command
  `npm run build`, base directory `web`, publish directory `web/dist`.
- **Cloudflare Pages**: same settings as Netlify.
- **GitHub Pages**: publish `web/dist` with the official `actions/upload-pages-artifact` +
  `actions/deploy-pages` workflow (build in `web/`, upload `web/dist`). `base: './'` makes subpaths
  like `/nightmare-carnival/` work.
- **itch.io**: zip the *contents* of `dist/` and upload as an HTML5 game. itch serves it over HTTPS
  inside an iframe, and WebRTC works there.

No backend, database or account is needed for the game itself. The deployed site talks to PeerJS
Cloud for matchmaking, and to STUN/TURN servers when connecting.

### Live alpha: Netlify

The alpha is live at **https://nightmare-carnival.netlify.app**: site `nightmare-carnival` on the owner's Netlify team (free
plan), deployed from `web/` with the Netlify CLI. `netlify.toml` holds the build settings and headers:
hashed `assets/` are cached for a year, everything else revalidates on each visit.

To ship an update (the CLI must be logged in to the owner's Netlify account: `netlify login`):

```bash
cd web
npm test && npm run build
npx netlify-cli deploy --prod --dir=dist --no-build
```

`web/.netlify/state.json` links the folder to the site (git-ignored). Without `--prod`, the CLI makes a
draft deploy on its own URL: a way to try a change before the testers see it.

Two Netlify specifics:
- **Visitor access.** The owner's team protects deploys with Netlify team login by default. This site
  protects only *non-production* deploys: the main URL is public, while draft and preview URLs stay
  behind the owner's Netlify login.
- **Badge.** The free plan injects a "Powered by Netlify" badge (an iframe, about 197×64 px) into the
  bottom-right corner. It cannot be hidden on that plan. When the badge is present, `style.css` lifts
  the menus and the title's credit line clear of it (`body:has(#nl-badge-frame)`); other hosts are
  unaffected.

---

## 5. Testing

### Automated (headless): `npm test`

`tests/net.test.ts` (27 tests) runs the real sessions over the in-memory loopback network
(`link.ts`), with configurable latency, jitter, loss and duplication:

- **Codec.** Round-trip of every type; truncated input throws; out-of-range values clamp (never wrap);
  dictionary sync with gaps.
- **Serialisation.** A busy co-op night round-trips within quantisation limits; interest management;
  corrupted snapshots throw.
- **Dense snapshot.** 477 enemies, 309 projectiles, 400 bullets and 320 pickups encode to
  **29.8 KB full / 13.5 KB delta**.
- **Replication.** Through lossy deltas (20% of snapshots dropped, acks 3 snapshots late), the mirror
  matches the host exactly. Stale and reordered snapshots are ignored.
- **Prediction.** Reconciliation converges to the host's position; no drift.
- **Validation.** Hostile and malformed messages and input packets are rejected or clamped, profiles
  are clamped, only whitelisted events are replayed, lobby codes are well-formed.
- **Sessions.**
  - Lobby: distinct characters, readiness, and start; a third player, a wrong version and strangers
    mid-run are refused; a flooding guest is dropped; leave and close are handled.
  - A **90 s synchronized night over 45 ± 15 ms, 3% loss, 1% duplication**, with drafts and the prize
    wheel resolved by both sides: host upload **~16 KB/s at 20 Hz**, guest RTT ~85 ms, 0 inputs dropped.
    The guest's drawn self leads the host's truth by a median **15 units** (p90 18.5): ≈ 70 ms of
    walking, the inputs in flight.
  - Every guest input is applied exactly once on a **144 Hz host** and on a **bursty-frame host**.
  - The guest holds still while the host lingers on a prize wheel.
  - Pause for both; a dropped guest makes the host wait, and the guest rejoins its seat with its token;
    carry on alone; the host leaving ends the guest's session; per-player payouts.

`tests/coop.test.ts` (12) covers the co-op *rules* in the simulation (D-51).

**Measured bandwidth** (delta snapshots, a bot-driven duo, guest acking one RTT behind):
| Night | Snapshot | Host upload @ 20 Hz |
|---|---|---|
| 2:00 | ~1.0 KB | 19 KB/s |
| 5:00 | ~2.1 KB | 41 KB/s |
| 10:00 | ~2.8 KB | 54 KB/s |
| 15:00 (densest) | ~5.2 KB | 101 KB/s (≈ 0.8 Mbit/s) |
| 20:00 | ~3.3 KB | 64 KB/s |

The guest's upload is ~4 KB/s of inputs.

### Two-tab harness (real PeerJS, one machine): `npm run dev`

In tab A's console:
```js
await __nc.coop.host('Alice')   // → "K7M2QP"
```
In tab B:
```js
await __nc.coop.join('K7M2QP', 'Bob')
```
Back in A:
```js
__nc.coop.start()
```
`__nc.coop.autopick()` auto-picks drafts and prize wheels on that tab, and `__nc.coop.diag()` dumps the
network diagnostics. These are dev-only tools; a production build has none of this.

### Cross-network checklist (for alpha testers)

Two people, **two different networks**: e.g. one on home Wi-Fi, one on a phone hotspot.

1. Host a lobby, join it, pick characters, ready up, start.
2. Play at least 5 minutes, through several level-ups, one prize chest and one coffin revive.
3. Press F3 on both machines and note the `route` (`host` / `srflx` / `relay`), `rtt`, `KB/s`, `lost`,
   and `prediction error`.
4. Try: the guest pauses; the host pauses; the guest refreshes mid-night and rejoins; the host goes
   back to the lobby for a second night.
5. Report anything that felt wrong: rubber-banding, stuck "Waiting for…" notes, wrong prizes, a frozen
   screen, or a connection that never opened (note both browsers and networks).

---

## 6. What has been tested

| Scope | Status |
|---|---|
| Automated loopback suite (sessions, replication, prediction, loss/jitter, disconnects) | **Passing**: 166 tests in the whole suite |
| Two browser tabs on **one machine**, real PeerJS Cloud signalling and WebRTC | **Done**: see the list below |
| The **deployed site** (Netlify), two tabs on one machine | **Done**: see below |
| Two machines on the **same LAN** | **Not yet tested** |
| Two machines on **different networks** (the alpha goal) | **Not yet verified.** Needs the checklist above, ideally with someone behind a strict NAT to exercise TURN |
| Safari / Firefox / mobile browsers | **Not yet tested** (developed in Chromium) |

What the same-machine two-tab session exercised:
- **Lobby.** Lobby codes, join by code (lowercase input normalised), character exclusivity, ready and
  start.
- **Live play.** The datagram channel opened (route `host`), steady 20 Hz at ~15 KB/s with ~700-byte
  snapshots. Coordinated drafts each way. Guest movement prediction matched the host exactly in all
  four directions.
- **Rewards.** A split 4-prize wheel with owner tags on the guest. A coffin and an assisted revive.
  The run end with per-player results, then back to the lobby.
- **Disconnects.** A guest refresh mid-night (the host waited; the guest rejoined its seat). The host
  leaving ended the guest's night cleanly. Error messages for a malformed or non-existent code.

On the **deployed site** (https://nightmare-carnival.netlify.app, 2026-10-30), two tabs on one machine:
- **Lobby.** Host by code; join with the code typed in lowercase; character exclusivity; ready and start.
- **Live play.** A running night with coordinated drafts: both tabs held at the same level-up. The host's
  screen showed both players; the guest's HUD showed its partner.
- **Guest's F3.** Datagram channel, route `host`, 19–21 snapshots/s at 4–18 KB/s, 0 lost, 0 invalid,
  prediction error 0.0.
- **Console.** No errors apart from a 404 for the optional `net-config.json`, which is now shipped empty.
- **Hosting.** Served over HTTPS; hashed assets marked `immutable`.

Two real bugs found there are fixed and covered by tests:
- negative timers wrapped in the byte codec, which caused a permanent hurt vignette on the guest;
- a per-frame idle check dropped most guest inputs on high-refresh hosts.

---

## 7. Known limitations (alpha)

- **Two players.** The simulation and wire format support more (slot tables go to 4), but the lobby
  and HUD are built for a duo.
- **No host migration.** The host's tab is the server, and closing it ends the night.
- **Netlify's free plan** shows a "Powered by Netlify" badge in the bottom-right corner (§4).
- **PeerJS Cloud** is a shared free service with no uptime guarantee. The default TURN relays are best
  effort. Strict networks may need your own TURN (§3).
- **The host's unlocks define the item pool.** Each player picks from the characters their own save
  has unlocked.
- **Results screens.** Night-wide counters (kills, damage dealt and taken, score) are shared totals.
  The weapon table, character and Lost Tickets are each player's own.
- **Endless "Lock-In" and the Daily Run are solo-only.**
- **What the guest sees.** The guest sees other entities ~50–100 ms in the past (interpolation). The
  host sees the guest as simulated. Under heavy jitter, the guest's character can look slightly uneven
  on the host's screen.
- **Unpredicted movement.** The bumper-car dash, pulls and knockback on the guest arrive as smoothed
  corrections.
- **Tab suspension.** If a browser suspends a tab entirely (mobile, battery saver), that player drops
  and the rejoin rules apply.
