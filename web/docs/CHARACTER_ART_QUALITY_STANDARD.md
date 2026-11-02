# Character art quality standard

How Nightmare Carnival's characters and creatures are built so they look deliberately crafted, not assembled
from procedural primitives (D-86). Everything stays procedural Three.js. The toolkit is
`src/render3d/sculpt/figure.ts`; the sculpt pipeline is `src/render3d/sculpt/sdf.ts`. The three benchmark
models that set the bar are:
- the Carny (`carny()` in `models/characters.ts`);
- the Evil Clown and the Carnival Brute (`evilClown()` and `carnivalBrute()` in `models/creatures.ts`).

The art direction doesn't change. The figures are 1930s carnival horror: slightly exaggerated, ink-outlined,
moody, handcrafted. What changes is the execution.

## 1. Who looks at a character, and from where

Every rule below follows from the camera.
- **50° above the horizon.** The camera is orthographic and looks south to north. It sees the tops of
  heads and hats, the shoulders, and the front at a steep angle. It rarely sees anything at eye level.
- **At normal zoom a figure is 80–110 px tall on a 1080-line screen.** One world unit is about 0.9 px, so a
  head is 12–16 px wide and an eye is 2–3 px.
- **The outline is about 1.3 px.** That is about 1.8 world units at play zoom, which is thicker than most
  facial features.
- **The lighting is dark and mixed:** a raking cold moon, a warm lantern from above and behind the player,
  coloured practical lamps, mist, and a vintage grade that partly desaturates.

So a figure is judged first as **a few large shapes with clear values**: hat or hair, face, torso, legs, one
accent. Detail is judged second, and only where it survives at a few pixels. A model that looks good only
in a close-up has failed.

## 2. What made the old figures muddy (the D-86 audit)

| Cause | Where | Effect | Fixed by |
|---|---|---|---|
| Every figure forced to one matte (roughness ≥ 0.82, metal ×0.2, no lamp glints) | renderer (`NC_MATTE`) | skin, cloth, leather, brass, glass and eyes all shaded alike: chalk | **shared fix**: each surface keeps its own response (roughness floor 0.36, metal ×0.7) |
| Crevice occlusion multiplied into the colour, up to 60% | sculpt | everything near anything else went dark and dirty | **shared plumbing**: kept as data (`aOcc`, shader `uOccK`); the standard bakes ≈0.2–0.25 |
| Curvature "wear" painted into the colour | sculpt | read as speckle on surface-nets meshes | the standard uses `paint: 0` |
| Noise in colour functions (`weather`, skin noise, hair tone, striped wear) | models | mottled, dirty colour at vertex resolution | the standard uses flat colour and smooth, deliberate gradients only |
| Patterns as vertex colours (stripes, diamonds) | models | smeared, zig-zag edges | **patterns drawn per pixel** (`pat`: stripes, bands, diamonds, dots) |
| Materials blended over 0.8 units where parts meet | sculpt | soft, bleeding boundaries | **layers**: garments are separate shells, so seams are modelled; `seam` option |
| One smooth-union blob per figure | models | soft forms melting into each other ("balloon" shoulders, egg heads) | layers, small blends inside a layer, distinct forms |
| Surface-nets vertices up to a third of a cell off the surface | sculpt | terraced curves, lumpy small forms | **shared fix**: each vertex pulled onto the true surface (one free Newton step) |
| Features thinner than a mesh cell (noses, lips, lash lines) | models | melted faces | min feature ≥ ~1.5 cells; small features are crisp details |
| An ink hull round every small detail | renderer + models | eyes, buttons and badges turned into black blots | per-part ink (`ink: false` on details and hidden layers; `aInkOff`) |
| Realistic 7-head proportions; a hat brim over the face from 50° | design | a stick under a hat; no face from the game camera | the HERO frame; hats tipped back |

Not causes, checked and kept:
- **The vintage grade:** a partial desaturation, part of the look.
- **Shadow maps:** stair-steps show only at close inspection zoom.
- **Tone mapping:** ACES, unchanged.

## 3. Silhouette

- **Recognisable as a dark shape** at play size, from 50° above. Test it with outlines on and colour
  ignored.
- **The top of the head carries the identity:** hat, hair or hood. From above it is the biggest, clearest
  shape. The Clown's scalloped ruff and dotted cone hat, the Carny's tipped boater, the Brute's knotted
  sack.
- **Shoulders and the torso's outline come second.** Use a V for heroes, a barrel for the brute and a
  baggy pear for the clown.
- **Hands and held objects read separately from the body.** Arms hang a little away from the torso
  (`armOut`). Props are big enough to read: the sledge, the pie, the card fan.
- **Brims must not hide the face from the game camera.** Tip a hat back about 0.35 rad, or keep the brim
  under about 1.4 × the head radius.

## 4. Geometry

**Build in layers** (`layered([...])`). Each layer is its own `Sculpt` with one material family:
- skin;
- hair;
- each garment as a shell over the body (shirt, waistcoat, trousers, suit);
- shoes or boots;
- hard accessories as crisp details.

Blend smoothly within a layer only. Where a garment ends, the edge is modelled: a cuff torus, a hem, a
collar band, a V cut deeper than the garment is thick.

Hidden body parts aren't sculpted. A shirt covers the torso, so there's no skin torso. A covered part that
must exist, such as the shirt's body under a waistcoat, gets `ink: false`. Otherwise its outline pushes out
through the garment above it as dark blotches.

**Forms.**
- Use few, large primitives with deliberate shapes: ellipsoids for masses, tapered boxes for jaws and
  chests (`box` with `tx`), round cones for limbs.
- Muscles are separate forms with small blends (k 1.2–1.6), not one smooth lump.
- Nothing sculpted is thinner than about 1.5 mesh cells. Smaller features are **details**: crisp meshes on
  one bone (eyes, brows, mouths, buttons, teeth, badges, stitches).

**Mesh resolution by role and by what the layer must carry.** A world unit is under a pixel at play zoom,
so finer cells are wasted there. Faces get the finest cells. Broad garments are coarse, because their
pattern is per pixel and their edges are modelled.

| Role | On screen | Face / head cell | Garments | Budget (triangles) |
|---|---|---|---|---|
| Hero (≤ 6) | 100–110 px | 0.45–0.5 | 0.6–0.75 | ≤ 70k (Carny 64k) |
| Miniboss / elite (1–3) | 120–160 px | 1.5 | 1.6–2.0 | ≤ 38k (Brute 35k) |
| Regular enemy (5–30) | 70–90 px | 1.5 | 2.0–2.5 | ≤ 15k (Clown 14k) |
| Swarm (30–300: balloons, stuffies) | 30–60 px | as needed | as needed | ≤ 10k |
| Boss (1) | 200+ px | — | — | ≤ 120k |

**The toolkit** (`sculpt/figure.ts`):

| Function | Builds |
|---|---|
| `HERO` | the playable cast's frame: REAL's landmarks, head +25%, broader shoulders, heavier limbs, crown still at ~89 |
| `styleHead` | a stylized head from a few large forms: cranium, a tapered jaw block, cheekbones, brow, nose, ears, shallow sockets |
| `styleFace` | designed features: almond eyes with an iris and catch-light, a dark lid, brows that read from above, a mouth line. All without ink |
| `styleHair` | a cap, a back-and-sides mass, sideburns and a few big clumps with a soft top light. No speckle. `ink: false` under a close scarf or knit hat |
| `styleHand` | a cartoon four-fingered hand as one mass (gloved or bare) |
| `styleShoe` | an upper, a welted sole and a heel |
| `vertical`, `shadowedJaw` | smooth, deliberate colour: top light, a crisp-edged five o'clock shadow |
| `LAYER`, `FAM` | standard build options per layer, material families |

## 5. Proportion and anatomy

- **Heroes use `HERO`.** A head a quarter larger than realistic, broader shoulders and chest, bigger
  hands (`styleHand` makes them 1.15×) and shoes, and the crown still at ~89 so framing, doorways and
  overhead bars still fit. Seven-head realism read as a stick from the camera.
- **Creatures keep their own skeletons** (`humanBones` on scaled `ADULT`). Exaggerate the forms that say
  what they are: the Brute's yoke and forearms, the Clown's head, gloves and shoes.
- **Faces sit slightly high and large** for the downward view: eyes about 0.2 × the head radius, brows thick
  (0.085 r) and high.

## 6. Materials

Families (roughness, metalness), from `FAM`. Each must read differently under the same light.

| Family | Values | Reads as |
|---|---|---|
| skin | 0.62, 0 | a soft sheen on the cheek and nose |
| greasepaint | 0.48, 0 | painted, a touch of shine |
| cloth | 0.95, 0 | dry, no highlight |
| wool | 0.9, 0 | dry |
| hair | 0.52, 0 | a soft gloss along the clumps |
| leather | 0.44, 0 | a broad sheen (shoes, belts) |
| rubber / latex | 0.42 / 0.3, 0 | glossy (clown shoes, nose) |
| brass / gold | 0.34 / 0.28, 0.8 / 0.95 | metal glints (buttons, plates) |
| iron | 0.5, 0.65 | dull metal (the sledge) |
| eye (glass) | 0.1 → 0.36, 0.1 | wet catch-lights |

Since D-86 the figure shader honours these on every figure. The floor is roughness 0.36, so nothing on a
figure goes mirror-bright, and metal is kept at 70%. Before D-86, every figure was clamped to the same chalk.

Figure highlights come from the moon and the lantern, not from the practical lamps. The lamp pool computes
specular for 24 lights; on figures that result is unused, so the compiler drops it. Using it cost +1.3 ms in
a 40-clown crowd.

A big pale creature can be given a drier skin of its own; the Brute uses 0.74.

## 7. Surface detail and noise

- **Large forms first, medium second, fine last.** If a detail doesn't read at play size or in close-up,
  it doesn't go in.
- **No noise in colour functions.** No `weather()` on new figures, no `vnoise` mottling, no curvature paint
  (`paint: 0`). A gradient must be smooth and mean something: light from above with `vertical`, a darker
  jaw, a darker bottom of the sack.
- **Patterns are drawn per pixel** with a part's `pat`, never as vertex colour. They are antialiased with
  `fwidth`, so at a distance a fine weave settles into an even tone instead of shimmering:
  - `stripes`: round the body, with a count per turn;
  - `bands`: horizontal, with a period;
  - `diamonds`: harlequin, round the body;
  - `dots`: front and side projections blended.

  Stripe width must read at play size, at least about 4 world units. A weave like the Brute's burlap is a
  low-contrast band at about 1 unit: a texture up close, a tone in play.
- **Occlusion is soft:** about 0.2–0.25 (`LAYER`). A carved socket or eye hole may take more (the hood,
  0.4). Occlusion is data (`aOcc`), so the inspector can switch it off to judge the colour beneath.

## 8. Colour and value

- **2–4 clear values per figure,** arranged by mass:
  - the Carny: a light hat, a mid face, a striped mid torso, dark legs;
  - the Clown: a white face and ruff, a mid striped suit, a red accent at the nose, buttons and shoes;
  - the Brute: a dark sack head, a warm mid skin, a red singlet, dark legs.
- **Head and torso must separate in value.** The Brute's first hood was the same tan as his arms, and the
  head vanished into the shoulders.
- **One saturated accent family per figure.** Glow is for eyes and authored signals only, never a
  substitute for form.
- **Judge colour under the game's grade.** It desaturates everything below mid-grey by about a third.

## 9. Outlines

- Ink marks the **silhouette and garment edges**: a hat brim, a ruff, a cuff, a sleeve.
- **Small details draw no ink** (`ink: false` on `detail`): eyes, brows, mouths, buttons, badges, teeth,
  stitches. A 1.3 px ring round a 2 px eye is a black blot.
- **Hidden layers draw no ink** (`ink: false` on the prim). Ink is about 1.8 world units thick at play zoom,
  so any surface closer than that under another layer leaks through. Covered parts must be ink-off, or at
  least 2 units deep.
- Props and large accessories keep their ink: the sledge, the pie tin, the hat.

## 10. Lighting compatibility

Check every figure in the inspector under three lights:
- `game`: the map's own;
- `studio`: a neutral key from the camera's left and a soft fill, grade off, to judge form and material;
- `dim`: moon and sky nearly out, lamps and lantern only.

Every figure must keep its silhouette and its value separation in `dim`. Rim light (`rim` on the model
definition) is for readability in the dark, not for shape.

## 11. Animation

- **Keep the skeleton and clips.** Bone names come from `humanBones` (hips, spine, chest, neck, head, arm,
  fore, hand, thigh, shin, foot ×2), plus any extras such as the Carny's `rag`. Clip names are what the
  renderer asks for: characters `idle`, `move`, `cast`, `hurt`, `dash`; creatures `move`, `attack`. The
  benchmark tests check both.
- **Every layer skins to the same bones.** A garment shell follows its limb.
- **Keep sleeves, cuffs and hems clear of the joint bands** so a bend doesn't tear them.
- **Check poses in the inspector**, for example `view({ anim: 'attack', t: 0.8 })`, and step a clip's
  phase for motion.

## 12. Performance

Measured on this PC (1600×900, High). The stress scene was 40 Evil Clowns and 2 Brutes around the Carny,
60 enemies in all, 240 frames; the original and the new code were run alternately:

| | Triangles / frame | ms / frame |
|---|---|---|
| Before (the original code) | 2.9 M | 2.5–3.3 |
| The new pipeline with the old models | 2.9 M | 3.1–3.2: no cost to models not rebuilt |
| After (14k Clown, 35k Brute, 64k Carny) | 3.84 M | 4.6–5.4 |

The new models cost about +2 ms at a deliberately extreme density, well inside 16.7 ms here. Weaker GPUs
scale worse, so:
- hold every role to its budget (§4);
- keep swarm creatures lean;
- before rolling the standard across the whole roster, measure the late-combat scene (`late-combat` state,
  `__nc.bench`).

If a target machine struggles, give regular enemies a crowd LOD: a coarser sculpt of the same layers, at
about 2× the cell. Sculpting time is unchanged in practice: Carny 0.65 s (was 0.97 s), Clown 0.18 s,
Brute 0.28 s, all in workers.

**GPU limits learned the hard way.** The actor shader is close to the GPU's limits:
- **Vertex attributes.** An instanced prop already uses nearly all the vertex attributes allowed. Declaring
  three more for every variant made every prop fail to link ("Too many attributes"), and they silently
  stopped drawing.
- **Opt in per geometry.** The figure data (`aOcc`, `aPat`/`aCol2`) is declared and interpolated only under
  `NC_OCC` / `NC_PAT`, which a batch turns on when its geometry carries them. Only figures with patterns pay
  for patterns.
- **Every geometry carries what its shader declares.** A missing attribute reads whatever another program
  left in that slot.
- **After any shader change, run `__nc.inspect.shaders()`**: it lists the programs that failed and why.

## 13. The visual QA process

1. **The inspector** (dev server only, `src/dev.ts`):
   ```js
   await __nc.inspect.open({ chars: ['carny'], enemies: ['evil_clown', 'carnival_brute'], gap: 120, copies: 1 })
   __nc.inspect.view({ yaw: [0, 35, 90, 180], el: 50, zoom: 4.2, dy: -55, light: 'game' })   // the game's angle
   __nc.inspect.view({ el: 12, zoom: 3.6, dy: -235, light: 'studio', post: false })           // eye level, studio
   __nc.inspect.view({ ink: false, occ: 0 })                                                   // outlines / occlusion off
   __nc.inspect.view({ anim: 'attack', t: 0.8 })                                               // hold a pose
   await __nc.capture('run', 'name')                                                           // the canvas, to artifacts/visual/
   __nc.inspect.close()
   ```
   It is a frozen lineup on a real map, through the game's own camera, renderer, lights, outlines and grade.
   It sets heading per figure, camera elevation, zoom, lighting preset, outlines, grade, occlusion strength
   and held poses. `__nc.inspect.shaders()` lists any shader program that failed to compile or link.
2. **Capture at full resolution** with the two-window harness's capture script (Electron window, CDP
   screenshots), or `__nc.capture`. Same lineup, angles, light, zoom and resolution for before and after.
3. **Look at the captures yourself, at play size first:**
   - the 1:1 crop at zoom 1;
   - then the close-up at the game's angle;
   - then eye level in studio light;
   - then a real fight (`__nc.shot` with a crowd).
4. **Gates.** A model is done when each of these passes:
   - geometry has no melted forms or floating parts;
   - the silhouette is recognisable at play size;
   - materials are distinct;
   - the face is readable from 50°;
   - garments have modelled edges;
   - shading shows forms without mud;
   - ink is on the silhouette only;
   - the clips play;
   - it belongs beside the balloons;
   - it is within budget.
5. **Tests:** `tests/characterArt.test.ts` holds the pipeline guarantees and each benchmark's budget,
   skeleton and clips. Add each rebuilt model to it.

## 14. The benchmarks

**The Carny (hero).**
- **Was:** seven heads tall with a gaunt realistic face hidden under a wide boater from the game's angle.
  The waistcoat stripes were smeared vertex paint, the collar details were ink blots, every surface was the
  same chalk, the rag hung like a third leg, and he was a stick at play size.
- **Now:**
  - on the HERO frame, in seven layers: skin, hair, shirt, waistcoat, trousers, shoes, rag;
  - the boater tipped back so his face (thick brows, almond eyes, a smirk) reads from 50°;
  - per-pixel stripes on a waistcoat cut open in a V onto the shirt and red bow tie;
  - sleeves rolled in two folds, a patched knee, soled shoes;
  - brass buttons and the badge without ink, and the rag a flat cloth.

**The Evil Clown (regular enemy).**
- **Was:** meshed at a coarse cell with blurred face paint, smeared stripes and noise-weathered colour. His
  ruff was buried, and he was a soft lump.
- **Now:**
  - seven layers: face, hair, suit, ruff, cuffs, gloves, shoes;
  - a greasepaint face with black diamonds through amber eyes, arched brows, a glossy red nose and a red
    grin with teeth;
  - a scalloped ruff wider than his head, which frames the face from above;
  - a dotted cone hat with its pompom on the tip;
  - per-pixel stripes on a baggy suit, frilled cuffs, white gloves and glossy red shoes.

**The Carnival Brute (complex).**
- **Was:** an egg head on two balloon shoulders, a noise-striped singlet and a box for a hammer.
- **Now:**
  - shoulders as a trapezius yoke, with separate deltoid, biceps and forearm forms in a dry, warm skin;
  - a banded strongman's singlet over a real belly, wrapped wrists, and a championship belt with a gold
    star plate;
  - a dark burlap hood with a fine weave, bunched under the throat rope and knotted at the crown, eyes
    burning in carved holes, a stitched seam and mouth;
  - a forged sledge: a turned haft, a leather grip, a bevelled iron head with steel faces.

The before and after sheets are listed in QA_REPORT (D-86).

**The rest of the cast (D-87)**, each in five to seven layers within the hero budget:
- **The Strongman:** a heavier frame; the yoke, deltoids, biceps and forearms as separate forms; a one-shoulder
  leotard with leopard spots per pixel, scooped clear of the bare left pectoral; a belt with a brass plate,
  wrapped wrists, laced boots, a waxed handlebar, a mallet that reads.
- **The Fortune Teller:** a fitted red headscarf cut on a slant with a rolled hem, a knot and coins; a wine
  shawl with a coin fringe over a cream blouse; a black bodice laced in gold; a fluted velvet skirt with a
  gold hem, lit from above.
- **The Commodore:** a white double-breasted coat over a round middle, navy shoulder boards, gold buttons and
  cuff rings, a medal; the sea's green rising from every hem (a meaningful gradient, not noise); white mutton
  chops and a walrus moustache; his cap tipped back so his face shows.
- **Mira:** a child's larger head with a bun and a bow; a pale blue dress with a round collar, puffed sleeves,
  a sash bowed at the back, and a skirt that flares to a crisp, glass-edged hem (it was a bulb).
- **The Lost Child:** a ribbed knit beanie (per pixel) pushed up so her eyes show; a hand-me-down coat split
  below the last button so the knees pass; a scarf; a plush bear with button eyes.
- **The Ringleader:** a tailcoat cut straight across at the waist with swallow tails on their own bone, black
  lapels, gold frogging, fringed epaulettes; white breeches into glossy riding boots; a silk top hat tipped
  back.

Lessons from the cast:
- **A hat or scarf sitting close over hair must not have hair poking through it, or hair's ink under it.**
  Both read as dark slashes. Keep 0.05 × the head radius between them, and use `styleHair({ ink: false })`.
- **`styleHair` below volume 1.0 sits under the skull's top:** skin shows through at the crown.
- **Surface searches near a part's rounded edge can miss.** A tie ended where `frontZ` found nothing and ran
  out through the back. Anchor details on the flat of a form.
- **Don't sculpt what a garment fully hides.** A shirt's belly under a coat or a seat under a leotard costs
  triangles and can only leak ink.
- **Child figures need their eyes clear of a brim from 50° in their idle pose,** which often looks down.

## 15. Rolling it out

When the benchmarks are approved, move the rest of the roster across in this order:
1. **The rest of the playable cast** (Strongman, Fortune Teller, Commodore, Lost Child, Ringleader,
   Mira). They share `HERO`, `styleHead`, `styleFace`, `styleHand` and the layer pattern, so each is mostly
   costume work. Budget ≤ 70k each. **Done in D-87** (52.8k–66.9k).
2. **The first map's regular enemies** (dunk-tank clown, puppet soldier, wind-up monkey, whack-a-mole,
   jack-in-the-box, ticket booth, carousel horse, bumper car), at about 15k each. Then measure late combat.
3. **The swarm** (balloons and stuffies) last. Light passes only: they already read well. Keep them
   ≤ 10k, and fix only their noise colour and ink blots.
4. **The other maps' creatures**, map by map, each batch measured in its own late-combat state.
5. **The bosses** (non-sculpted; they use the prop shader with `detail`) as a separate pass with their own
   inspector lineup.

Each batch gets the same before and after captures, budget and test entries, and a scorecard line.
