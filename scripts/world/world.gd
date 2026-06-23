extends Node2D
## The Carnival Core zone (03 §2–3, 09 §M3), programmer art. A bounded grid floor
## plus labeled attractions and a 3-gate fence chokepoint. Each element is data
## (`_elements`) so the zone is one editable list; solids are StaticBody2D on the
## WORLD layer (enemies seek + wall-follow around them, 03 §3). Real tilemaps/
## lighting/props arrive at M6.

@export var half_extent: Vector2 = Vector2(2200, 2200)
@export var grid_step: float = 128.0
@export var floor_color: Color = Color(0.09, 0.07, 0.12)
@export var grid_color: Color = Color(0.16, 0.13, 0.22)
@export var border_color: Color = Color(0.5, 0.2, 0.35)

const SOLID := Color(0.22, 0.17, 0.28)
const SOLID_EDGE := Color(0.5, 0.4, 0.22)
const FENCE := Color(0.28, 0.2, 0.16)
const FENCE_EDGE := Color(0.55, 0.42, 0.25)
const DECOR := Color(0.14, 0.12, 0.2)

# kind: "solid" (collides + fill + label) · "decor" (fill + label) · "label" (text only)
var _elements: Array[Dictionary] = [
	# --- attractions (solid cover) ---
	{ "rect": Rect2(-1180, -340, 380, 380), "kind": "solid", "color": SOLID, "label": "CAROUSEL" },
	{ "rect": Rect2(980, 220, 220, 240), "kind": "solid", "color": SOLID, "label": "TICKET BOOTH" },
	{ "rect": Rect2(-1320, 560, 250, 200), "kind": "solid", "color": SOLID, "label": "PRIZE STAND" },
	{ "rect": Rect2(320, 780, 190, 170), "kind": "solid", "color": SOLID, "label": "STALL" },
	{ "rect": Rect2(700, 780, 190, 170), "kind": "solid", "color": SOLID, "label": "STALL" },
	{ "rect": Rect2(510, 1120, 190, 170), "kind": "solid", "color": SOLID, "label": "STALL" },
	# --- gate fence (horizontal, y=-1150) with 3 gaps at x=-1000/0/1000 ---
	{ "rect": Rect2(-2000, -1178, 880, 56), "kind": "solid", "color": FENCE, "label": "" },
	{ "rect": Rect2(-880, -1178, 760, 56), "kind": "solid", "color": FENCE, "label": "" },
	{ "rect": Rect2(120, -1178, 760, 56), "kind": "solid", "color": FENCE, "label": "" },
	{ "rect": Rect2(1120, -1178, 880, 56), "kind": "solid", "color": FENCE, "label": "" },
	# --- text-only markers ---
	{ "rect": Rect2(-260, -470, 520, 60), "kind": "label", "color": DECOR, "label": "★ BIG TOP ★" },
	{ "rect": Rect2(-1120, -1250, 240, 50), "kind": "label", "color": DECOR, "label": "GATE 1" },
	{ "rect": Rect2(-120, -1250, 240, 50), "kind": "label", "color": DECOR, "label": "GATE 2" },
	{ "rect": Rect2(880, -1250, 240, 50), "kind": "label", "color": DECOR, "label": "GATE 3" },
	{ "rect": Rect2(900, -2010, 900, 60), "kind": "label", "color": DECOR, "label": "🎡 FERRIS WHEEL (skyline)" },
	{ "rect": Rect2(-500, 1980, 1000, 60), "kind": "label", "color": DECOR, "label": "～ THE SEA ～" },
]

func _ready() -> void:
	MapBounds.set_bounds(-half_extent, half_extent)
	for el in _elements:
		var r: Rect2 = el.rect
		if el.kind == "solid":
			var body := StaticBody2D.new()
			body.collision_layer = CollisionLayers.WORLD
			body.collision_mask = 0
			body.position = r.position + r.size * 0.5
			var cs := CollisionShape2D.new()
			var shape := RectangleShape2D.new()
			shape.size = r.size
			cs.shape = shape
			body.add_child(cs)
			add_child(body)
		if el.label != "":
			_add_label(el.label, r)
	queue_redraw()

func _add_label(text: String, r: Rect2) -> void:
	var lbl := Label.new()
	lbl.text = text
	lbl.position = r.position
	lbl.size = r.size
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.add_theme_font_size_override("font_size", 30)
	lbl.modulate = Color(1, 1, 1, 0.7)
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(lbl)

func _draw() -> void:
	var rect := Rect2(-half_extent, half_extent * 2.0)
	draw_rect(rect, floor_color)
	var x := -half_extent.x
	while x <= half_extent.x:
		draw_line(Vector2(x, -half_extent.y), Vector2(x, half_extent.y), grid_color, 1.0)
		x += grid_step
	var y := -half_extent.y
	while y <= half_extent.y:
		draw_line(Vector2(-half_extent.x, y), Vector2(half_extent.x, y), grid_color, 1.0)
		y += grid_step
	draw_rect(rect, border_color, false, 6.0)
	for el in _elements:
		if el.kind == "solid" or el.kind == "decor":
			var r: Rect2 = el.rect
			draw_rect(r, el.color)
			draw_rect(r, SOLID_EDGE if el.kind == "solid" else FENCE_EDGE, false, 3.0)
