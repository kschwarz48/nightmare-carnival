# Rendering guide

How Nightmare Carnival draws a frame, and the reusable techniques to reach for when adding content.
Everything is procedural Three.js (r169) — no external models or textures. The simulation never
imports Three.js; `src/render3d/` reads the sim each frame. Design records: D-35…D-50.

## Frame anatomy

`GameRenderer3D.render()` (`src/render3d/renderer3d.ts`):

1. **Camera** — fixed orthographic view 50° above the horizon (`core/view.ts`), smooth follow with
   look-ahead and boss framing. Sim (x, y) → world (X, Z), Y up; models face +Z (south, toward the
   camera).
2. **Lighting** (`updateLighting`) — the moon (directional, shadows, low and raking from the
   north-west), the player's lantern (spot, shadows on High), a boss spot, and the **practical-light
   pool** (below), refilled every frame from lamps, string lights, booths, attraction glows, boss
   glows, explosions and the two theatre searchlights.
3. **Batches** — every repeated model is an instanced `ActorBatch`/`StaticBatch`
   (`core/batch.ts`); per-instance transform, animation row/phase, tint + emissive gain, rim light.
4. **Decals and billboards** — telegraphs and zones (`DecalBatch`), particles and glows
   (`BillboardLayer`), damage numbers.
5. **Post** (`post.ts`) — HDR → soft wide bloom → ACES (OutputPass) → vintage grade (selective
   desaturation, split toning, inky-blue lows, S-curve, grain, vignette, gameplay overlays).

`renderer.info` is reset once per frame and accumulates every pass (shadows, scene, post), so
`calls/triangles` are true per-frame totals.

## Shared shader systems

* **Actor material** (`core/materials.ts`) — `MeshStandardMaterial` + `onBeforeCompile`: part rig or
  GPU skinning (bone texture), per-instance tint/rim/flash, per-vertex roughness/metal/emissive
  (`aSurf`), the light pool, cool shadow fill, ground mist, ink outlines (inverted hull, D-44),
  occluder dithering. D-86 (docs/CHARACTER_ART_QUALITY_STANDARD.md):
  * figures (`matte`) honour each surface's roughness and metal, with a floor of 0.36;
  * baked occlusion is data (`aOcc`, strength `uOccK`);
  * costume patterns are drawn per pixel (`aPat`/`aCol2`: stripes, bands, diamonds, dots);
  * a part can draw no ink (`aInkOff`).

  The occlusion and pattern paths compile only where a batch's geometry carries them (`NC_OCC`, `NC_PAT`).
  The shader is close to the GPU's attribute and varying limits.

  Options as defines:
  `matte` (figures), `dither`, `detail` (procedural prop surfaces, below), `wind` (ground cover sways
  with shared time — no per-instance updates).
* **Light pool** (`core/pool.ts`, D-36/D-46) — 24 strongest practicals in uniforms, evaluated by
  every world shader with the same **windowed inverse-square** falloff: normalised so the ground
  under a source keeps its brightness while the pool tightens around it (`POOL_CONC`). A light with
  `hard > 0` is a **theatre spot**: a crisp disc cast from high above (searchlights). Selection is a
  scored, allocation-free in-place sort; raise `priority` for lights that must win (searchlights 6).
* **Mist** (`MIST_GLSL`, D-46) — world-anchored rolling banks that swell and ebb, nearly clear
  between banks, thicker at the woods and sea; applied with `ncFog()` as an in-scattering veil
  (absorbs a little, glows with moon + practicals). Figures receive 30%.

## The ground (`world/ground.ts`, `world/paint.ts`, D-45)

* **Analytic layout**: avenues are polyline distance fields; the plaza, promenade, Tilt-a-Whirl deck
  and grease slicks are analytic shapes — crisp at any zoom. The static parts are **baked once on
  the GPU at startup** (`bakeFields`): texture A = (distance to avenue edge, across, along, half
  width), texture B = low-frequency noise (edge rag, field mottling, puddle mask). Per pixel the
  shader does two fetches plus fine detail.
* **Materials**: night grass with blades and trodden mud; dirt avenues with **wheel ruts that follow
  each avenue** (across/along coordinates), pebbles, straw; domed cobbles with mossy joints and a
  curb of dressed stones; boardwalk planks with nails; riveted, rusting steel deck.
* **Relief → normals**: each surface outputs a height; the normal comes from screen-space
  derivatives of (x, h, z). The moon, the lantern and every pool light rake across it.
* **Water**: rain pools in ruts and hollows — dark albedo, near-mirror roughness, analytic breeze
  wobble instead of derivative noise, high-shininess pool specular (lamps reflect at the correct
  mirror point), a cool sky sheen strongest at the shallow rim.
* **Contact occlusion**: `bakeGroundData()` paints every prop footprint (tight core + wide skirt)
  into a 1024² texture; the ground darkens there.

## Architecture kit (`models/arch.ts`, D-47)

The 50° camera sees roofs and fronts, so that is where detail goes. Reusable pieces:

| Function | Use |
|---|---|
| `patch(fn, nu, nv, twoSided)` | any parametric surface: canvas, awnings, banners, roofs |
| `canvasRoof()` | peaked striped canvas roof, one patch per stripe (crisp seams), sag between rafters, gables, ridge pole, swaying pennants |
| `stripedCanopy()` | round striped canopy/tent: per-stripe panels sagging between ribs, rope seams, optional wall (carousel, small tents; the Big Top uses the same construction in `bosses.ts`) |
| `valance()` | scalloped valance with tassels |
| `headerBoard()` | arched marquee board ringed with bulbs (lettering via `signMesh`) |
| `pagodaRoof()` | hipped roof of overlapping scalloped shingle courses, concave slopes, upturned corners, shadowed lips, gilt caps (ticket booth, funhouse) |
| `turnedPost()`, `bunting()`, `diamonds()` | posts, flag lines, painted motifs |

Booths (`stall()` in `models/props.ts`) compose these: deck, turned posts, canvas side walls,
diamond-painted counter, roof, valance, header, eave lanterns. Header sign placement reads
`BOOTH` so lettering always sits on the board.

## Procedural surface detail (`detail` define, D-47)

Applied to props and boss rigs, keyed off each vertex's surface preset (`SURF` roughness/metal), in
model space so it sticks to the object: wood grain along the boards (horizontal vs vertical by
normal), canvas rain streaks/stains/mildew, paint chipped through to dark wood, rust on iron and
verdigris on brass (raises roughness, lowers metalness). Emissive parts are skipped. Characters and
creatures keep their baked sculpt paint instead.

## Ground cover and dressing (`world/clutter.ts`, D-48)

Seeded scatter that follows the same layout as the ground: grass tufts (dense along avenue edges and
against structures, clumped in open fields; dry vs green via per-instance tint), stones along the
avenue edges, litter around booths, straw by the stalls. Instances are grouped into 1100-unit
chunks — one batch per (kind, chunk) with a computed bounding sphere — so three culls off-screen
chunks. Grass uses the `wind` define (no per-frame CPU work) and is hidden on Low quality. Story
pieces: a roped queue at the ticket booth, a generator with cables to the lamps, a signpost.
None of it is solid; the simulation is untouched.

## Telegraphs (D-49)

`teleFill` decals use the `NC_HATCH` decal variant: crawling diagonal caution stripes with scorched
grain, so danger reads as an authored marking on the ground; lane edges get an additive glow. Colour
roles stay: danger orange-red, caution amber, safe green.

## Death scenes (D-50)

The renderer remembers the last drawn pose of every on-screen enemy (pooled records). When an enemy
vanishes from the sim while in view, its body plays a death beat through the same batch — balloons
swell and burst; others topple sideways/back, squash and sink while a short flash fades. Records
reset when a new game starts.

## Adding content

* **A prop**: write a builder in `models/props.ts` (use the kit), register it in `PROP_SPECS`
  (`world/props.ts`); give it a footprint in `data/map.ts` if solid (contact occlusion follows
  automatically). Use `SURF` presets honestly — they drive the procedural detail.
* **A light**: `pool.add(x, y, radius, intensity, r, g, b, height, priority, hard)` each frame from a
  visible source. Keep sources visible (bulb, lantern, window) — every pool should have one.
* **A ground surface**: add a mask + material block in the ground shader (output colour, height,
  roughness, wetness); static fields belong in `bakeFields`.

## Performance (desktop, this machine, 1600×900, High, DPR 1)

| Scene | ms/frame (CPU+GPU, `__nc.bench`) | draw calls | triangles (all passes) |
|---|---|---|---|
| Late combat, before this pass | 3.46 | 256 | 2.51 M |
| Late combat, after | ≈4.6–5.7 (steady ≈4.65) | 291 | 2.90 M |

Measured contributions after the pass: ground ≈1.26 ms (halved by the GPU field bake), clutter
≈0.7 ms, ink outlines ≈0.4 ms, shadow maps ≈0.2 ms. Triangle totals exceed the generic 750 k
starting budget because shadow passes and ink hulls re-draw the sculpted crowds; frame time is the
binding metric and stays far inside 16.7 ms here. Levers if a target machine struggles: Low quality
(no bloom/grain/shadows, no grass), lower DPR, fewer clutter chunks, coarser crowd sculpts.

## Engineering optimization pass (D-73)

Measured on an RTX 2070 / i9-9900K in Electron 44 (Chromium 152) with GPU timer queries; method, scenarios
and before/after tables in `docs/ENGINEERING_OPTIMIZATION_REPORT.md`.

- **Tiled light culling** (`core/pool.ts`). Every world shader looped over all 24 pooled lights at every
  pixel; a light only reaches its radius, so the CPU now marks, on a 32×32 grid over the lit area, which
  lights touch each tile (24 bits in a tiny RGBA texture) and `poolLight`/`poolLightFlat` evaluate only
  those. Fragments outside the grid evaluate every light, so the result is exact (pixel-compared: Carnival
  max difference 1/255, Fun House 0; the Boardwalk's differences equal its own frame-to-frame animation).
  Heavy late-game scenes: −9 to −11 ms GPU at 3440×1440.
- **Background shader compilation** (`renderer3d.compileInBackground`). A model's first appearance
  compiled its shaders on the spot (~200 ms stalls); a new batch now compiles through
  `KHR_parallel_shader_compile` and stays hidden for the few frames until ready. Shipped builds also skip
  reading every program's info log (`renderer.debug.checkShaderErrors` only in dev), which forced each
  compile to finish synchronously. Captures wait on `renderer.whenCompiled()`. A background compile binds
  the post chain's buffer first: the scene draws into it, and a program depends on its target's colour
  space and tone mapping (compiled against the screen, it would build the wrong variant).
- **Boot shader warm-up** (`renderer3d.warmUp`). The first frame after the loading screen compiled ~30
  programs on the spot: 6.4 s frozen on ANGLE/D3D11. Boot now compiles the whole scene (hidden boss rigs
  included) and every post pass in the background behind the loading screen, draws one attract-demo frame
  there (its batches compile in the background), then one more for shadow-depth variants. Measured: the
  first visible frame 6.4 s → 62 ms; an interactive title screen at ~6.5 s instead of ~9.8 s.
- **Sculpting in workers** (`models/sculptPool.ts`, `sculptWorker.ts`, `sculptPack.ts`). Characters took
  0.6–0.8 s each on the main thread and only one was built at boot, so a co-op partner or the Midway's cast
  froze a frame on first draw. Up to four workers now sculpt every creature and character in parallel; boot
  waits for the creatures and the last character, the rest arrive in the background. Worker output is
  checksum-identical to a main-thread sculpt.
- **Sound synthesis in a worker** (`audio/synthWorker.ts`). All 152 effect recipes rendered on the first key
  press (~1.6 s); they now render during boot in the same order (the shared noise generator keeps every
  sound identical) and are wrapped into buffers on first play.
- **Developer overlay (F2)** (`ui/perfHud.ts`, `core/perf.ts`): FPS, frame time p95/p99/max, spikes, the
  frame's CPU split (net, sim, render, HUD), the sim's systems, GPU time (timer queries), draw calls,
  triangles, particles, crowd counts, heap, long tasks and the co-op link. Dev builds always; a shipped build
  with `?devhud`. The per-system timers run only while it's open.
- **A/B switches**: `?legacy` (or `?legacy=tiles,compile,workers,shaderchecks`) turns these changes off for
  benchmarking one build both ways (`core/flags.ts`).
- **Benchmarks**: `npm run bench:sim` (headless sim), `npm run bench:models` (sculpt costs), and
  `cd desktop && npx electron bench.js --url=<dev or VITE_DEVTOOLS=1 preview>` (real-time scenarios on the
  GPU; `--size=1920x1080`, `--qualities`, `--uncapped`, `--gc`, `--eval=file.js --cpuprofile=out`).
