# Online Co-op — up to six players (alpha)

Up to six players, one night, real time, over the internet, with no game server. One browser **hosts**.
It runs the only simulation. Up to five friends **join** with a six-character code and play the same
night (D-54).
Matchmaking uses the free PeerJS signalling service. The game traffic itself goes peer-to-peer over
WebRTC data channels.

Design decisions: D-51 (co-op rules), D-52 (netcode), D-53 (party scaling and co-op UX), D-54 (parties
of six) in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md). Test status: [§6](#6-what-has-been-tested). Do read it:
cross-network play has **not** been verified yet.

**Live alpha:** <https://nightmare-carnival.netlify.app> (Netlify; deployment in [§4](#4-deploying-the-alpha-static-hosting)).

---

## 1. For players

1. Both players open the game's web address: **https://nightmare-carnival.netlify.app** for the alpha (any deploy must be
   HTTPS).
2. **Host:** title screen → **Multiplayer** → enter a name → **Host a Game**. A lobby opens with a
   code like `K7M2QP`. **Copy** it and send it to your friend.
3. **Guests (up to five):** **Multiplayer** → name → **Join a Game** → type the code → **Join**.
4. Each player picks a character (friends may pick the same one; coloured dots show who picked what).
   Then press **Ready!** The host chooses the difficulty and pulls **Start the Night!** once everyone
   is ready.

The rules follow Vampire Survivors co-op:

| | |
|---|---|
| Experience | **Shared.** Either player's tickets fill one bar and level the whole party. |
| Level-ups | Each player drafts **their own** card. The night stays frozen until **everyone** has chosen. A "Waiting for …" note names who is still choosing. |
| Builds | **Independent.** An item one player owns never appears in the others' drafts. An evolution may use a teammate's passive. |
| Slots | Weapons + passives each, by party size: **6 / 4 / 3 / 2 / 2 / 2** for 1–6 players. VS stops at four (2); five and six hold there. |
| Prize chests | **One wheel, split prizes.** Everyone watches the same wheel; each prize is tagged with its owner's name. Prizes go to whoever has had the fewest so far tonight. The night resumes when everyone has finished watching. |
| Falling | A player at 0 HP drops into a **coffin**. It opens by itself in 40 s, or in 6 s with a teammate standing next to it. The revived player gets back half their health. If everyone is down, the night ends. |
| Pause | Anyone can pause. It pauses the night for **everyone**, and the others see "Paused by …". |
| Rewards | Each player banks **their own** Lost Tickets and achievements into their own save. The Last Song's reward unlocks for both. |
| Difficulty | Crowd density ×1.25 / 1.45 / 1.6 / 1.72 / 1.82 and enemy + boss HP ×1.3 / 1.5 / 1.7 / 1.85 / 2.0 for 2–6 players (guesses to tune). |

**The party leaderboard (D-71).** Every player's results screen shows THE PARTY: each player's own
damage, boss damage, kills, tickets, revives given, damage taken and downs, ranked by damage, with the
best in each column in gold. The host keeps the tally:
- a zone's damage is its layer's, and a burn's ticks go to whoever hit last;
- a revive counts for every teammate standing by the coffin when it opens.

Each guest's end stats carry the whole table (`RunStats.party`, `me`). The results screen draws only a
well-formed table (`partyRows`), so a broken peer can't crash it.

After the night, the host can press **Back to the Lobby** for another round with the same connection.

**The Midway (D-60).** If the host has fully completed the first night, friends who join land on the
host's **Midway hub** instead of the lobby screen. Everyone walks the grounds together, and more
friends can join while the party is there. The host walks into the **Big Top** to take everyone to
character select; after the night, **Back to the Midway** returns everyone to the hub.

**F3** toggles the network diagnostics: latency, snapshot rate and size, loss, the connection route,
and prediction error. A small **● NN ms** latency readout is always shown in co-op.

### If something goes wrong

- **"No lobby with that code."** Check the code. The host must keep the lobby open: closing that tab
  closes the lobby.
- **A guest refreshes or drops mid-night.** The night pauses for everyone for up to 20 s with "…lost
  connection — waiting for them to rejoin" and, on the host, a **Carry on without them** button. The guest rejoins the same seat by
  joining with the same code from the same tab.
- **The host leaves.** The night ends, and the guest sees "The host ended the night." There is no host
  migration in the alpha.
- **"Found the lobby, but the connection to the host never opened."** Something blocks peer-to-peer
  traffic on one side. Check the **connection check** line on the multiplayer menu.
  - **Opera / Opera GX:** Settings → Privacy & security → WebRTC → "Use any suitable network
    interface", and turn off its built-in VPN. The setting can switch itself back after a restart.
  - **Otherwise:** try Chrome or Edge, or another network (a phone hotspot works), and make sure
    neither player is on a VPN.
  - **Still failing:** the pair needs a TURN relay (§3).

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
SLA). ICE uses free public STUN (Google, Cloudflare). **There is no relay by default:** PeerJS's
built-in TURN servers answered neither UDP nor TCP in testing (2026-10-30), so they were dropped
(D-59).

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

### Adding a relay (TURN)

A relay carries the traffic when two players can't connect directly. Free tiers exist, all needing an
account: e.g. [ExpressTURN](https://expressturn.com/), [Metered Open Relay](https://metered.ca/tools/openrelay/),
Cloudflare Realtime TURN. Put the credentials in `public/net-config.json` and redeploy:

```json
{ "iceServers": [
  { "urls": "stun:stun.l.google.com:19302" },
  { "urls": ["turn:YOUR_TURN_HOST:3478", "turn:YOUR_TURN_HOST:443?transport=tcp", "turns:YOUR_TURN_HOST:443"], "username": "…", "credential": "…" }
] }
```

Include a TCP/TLS (443) entry: browsers that block non-proxied UDP can still reach a relay that way.
Anything in this file is public.

### Running your own

- **Signalling.** The PeerJS server is a small Node app (`npx peerjs --port 9000 --key peerjs`, or its
  Docker image). It only brokers connections; no game traffic passes through it.
- **TURN.** Self-host [coturn](https://github.com/coturn/coturn), or use a hosted TURN service; several
  have free tiers. Anything in a static `net-config.json` is public. For a wider release, issue
  short-lived TURN credentials from a small endpoint instead of a fixed secret.

---

### Parties of three to six (D-54)

- **One stream per guest.** Each guest gets its own snapshot encoder, sequence numbers and cosmetic
  queues: interest management means guests see different entities, so "already sent" is per receiver.
  The string dictionary is shared and acknowledged per guest. A guest who rejoins restarts only its
  own stream.
- **Hold status.** The host works out what the night is waiting on (`draft`, `prize`, `reconnect`,
  `pause`) and for whom, and broadcasts it when it changes. Every screen words its waiting note from it.
- **Upload.** The host uploads one stream per guest. Measured in a 40 s six-player test at the start of
  a night: ~116 KB/s total (about 20–25 KB/s per guest). Late-night snapshots are bigger, so expect up
  to several hundred KB/s with five guests at the densest moments. With three or more players, big
  snapshots (>3 KB) drop to 15 Hz. The host should be the player with the best upload.
- **Stalled tabs.** Arrivals are stamped at the next update, and the background clock runs whenever
  animation frames stall, so a guest who alt-tabs (or a host whose window is covered) keeps the link.

### The Boardwalk (D-68, PROTO 10)

- **The map.** `boardwalk` is a third map id the host can pick in the lobby; guests load the same
  world.
- **The sea is computed on every machine.**
  - The tide, the coaster and the Sea Wheel are pure functions of sim time.
  - The quest's low water rides in its bytes.
  - `refreshSea` runs in the guest's mirror every step, so wading, the waterline and the shaders agree
    with the host.
  - A guest's prediction uses the same `walkClamp`, so it is never corrected for wading or the pier's
    edges.
- **New bits on the wire:**
  - `PF.marked`: a player marked by a Ticket Taker's stub (every screen draws the mark);
  - `ET.cracked`: a barnacle's crust has cracked;
  - the Summer's End chain's 24 bytes in `questExtra`;
  - the new bullet kinds travel as strings in the snapshot dictionary.
- **Interiors.** Each screen cuts away the building its own player is in. Positions replicate as
  anywhere else, so partners can be in different buildings at once.
- **PROTO 10.** Old builds can't join new lobbies; everyone reloads.
- **The stage ring (D-71).** The host now reels players back into a Boardwalk boss's stage ring, as the
  Puppet King's stage always did. A guest's prediction already applied that pull, so a guest who walked
  out of a ring was corrected back out until this was fixed. No protocol change: PROTO stays 10.
- **The tide** turns on a timer of sim time (D-71), so every screen's notice of a turn ("THE TIDE IS GOING
  OUT") comes at the same moment without any message.

### The lobby doesn't flash (D-71)

Every lobby change (a character, the map, the difficulty, a ready) used to rebuild the whole screen,
replaying its entrance animation on every machine. While the lobby is open it is now brought in line with
a freshly built copy, node by node (`morph` in `ui/dom.ts`):
- unchanged nodes stay where they are, with their focus, pictures and animations;
- attributes and click handlers are synced;
- the focus ring of keyboard and gamepad navigation (the `focus` class) is kept.

### Interact presses (D-67, PROTO 9)

- **What.** The Fun House quest's hands-on steps are presses of interact (E, or A on a pad). A guest's
  press has to reach the host's sim, which runs the quest.
- **How.** Every input a guest sends carries `ia`, its running count of presses (one byte, wrapping at
  256). When the host applies an input whose count differs from the last one it applied for that seat,
  that player's sim input gets a press for the tick. The count rides in every input, including the
  redundant copies, so a lost packet never loses a press and a duplicate never doubles one. On a rejoin
  the host relearns the count from the first input it hears.
- **Test.** `tests/net.test.ts` sends one press over a link with 15% loss and 5% duplication and checks
  the host's sim sees it on exactly one tick.
- **PROTO 9.** The input packet grew a byte per input, so old builds can't join new lobbies.

### Chat and miniboss health (D-65, PROTO 8)

- **Chat.**
  - **Keys.** T opens a line in a night, on the Midway or in the lobby. Enter sends it; Esc closes it.
  - **Relay.** A guest's line goes to the host (`{ t: 'chat', text }`). The host relays it, with the
    speaker's slot and name, to everyone, the speaker included (`{ t: 'chat', from, name, text }`), so
    every screen shows the same lines in the same order. The host's own lines take the same path.
  - **Validation.** Both directions are validated. Control characters are stripped, whitespace is
    collapsed, lines are capped at 140 characters, and names are cleaned. Lines are drawn as text,
    never markup.
  - **Flood guard.** Each guest gets a burst of four lines, refilling one every 0.7 s. Faster lines are
    dropped, not punished.
  - **Quest log.** Every whisper and fortune of a hidden quest is written into each player's log
    locally (quest cues already reach every machine).
- **Miniboss health.** The Carnival Brute and the Grand Display wear a health bar overhead. Ordinary
  enemies don't send their health to guests, so minibosses get a few bytes of their own (pool index
  and 0–255 health).
- **PROTO 8.** Old builds can't join new lobbies; everyone reloads.

### Map choice and the Fun House (D-63, PROTO 7)

- **The host chooses.** The night's map is the host's choice. The lobby carries `map`; `setMap` is
  refused once a run has started. Every guest's lobby shows it. `StartCfg.map` tells every machine
  which world to build, and the guest's mirror `Game` runs the same map's tables. An unknown map id
  never survives validation: the lobby falls back to the Carnival Core, and a start config drops the
  field.
- **The machinery is predicted.** Guests run these from sim time and replicated state, as the Midway's
  rides were:
  - the Fun House's pivots;
  - the dressing-room door (`GF.doorOpen`);
  - the shuffle event's timer;
  - the conveyors' push.

  Illusion decoys carry `EF.illusion`, so guests see them as decoys too.
- **Quests have a generic block.** After the Last Song's block, every other quest chain sends its own
  bytes (`netState` / `applyNet`). The Unreflected is 17 bytes, and guests draw the same quest state as
  the host. Bumping PROTO to 7 keeps older builds out of new lobbies.

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
| Automated loopback suite (sessions, replication, prediction, loss/jitter, disconnects, map choice) | **Passing**: 231 tests in the whole suite |
| The Fun House in co-op | **Loopback only**: lobby map choice, guests building the map, the quest through snapshots. No real two-machine night yet |
| Two browser tabs on **one machine**, real PeerJS Cloud signalling and WebRTC | **Done**: see the list below |
| The **deployed site** (Netlify), two tabs on one machine | **Done**: see below |
| **Three** tabs on one machine (host + two guests), real PeerJS, dev server | **Done** (2026-10-30): six-seat lobby, shared characters, 3 + 3 slots, party HUD, both guests kept alive in background tabs, mirrors matched the host |
| **Six** players | **Simulated only** (loopback, 3% loss): see `tests/net.test.ts` "parties of up to six" |
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

- **Six players** have only been run in the simulated network tests and with three tabs on one machine;
  a real six-machine night is the next test. The host's upload is the limit (§2).
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
- **Unpredicted movement.** The bumper-car dash and knockback on the guest arrive as smoothed
  corrections. Inhale pulls are predicted (D-56).
- **Tab suspension.** If a browser suspends a tab entirely (mobile, battery saver), that player drops
  and the rejoin rules apply.
