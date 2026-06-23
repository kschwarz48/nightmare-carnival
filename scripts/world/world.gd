extends Node2D
## The map (07 §3). Programmer-art Carnival Core: a bounded grid floor + a few
## solid obstacle blocks for tactics/cover. Real tilemaps/lighting arrive at M6.

@export var half_extent: Vector2 = Vector2(2200, 2200)
@export var grid_step: float = 128.0
@export var floor_color: Color = Color(0.09, 0.07, 0.12)
@export var grid_color: Color = Color(0.16, 0.13, 0.22)
@export var border_color: Color = Color(0.5, 0.2, 0.35)
@export var obstacle_color: Color = Color(0.2, 0.16, 0.26)
@export var obstacle_border: Color = Color(0.45, 0.35, 0.2)

## Solid cover blocks (WORLD layer), Rect2 in world space.
var _obstacles: Array[Rect2] = [
	Rect2(-820, -380, 260, 260),
	Rect2(520, 140, 300, 200),
	Rect2(-300, 560, 220, 360),
	Rect2(900, -760, 220, 220),
	Rect2(-1100, 640, 240, 240),
]

func _ready() -> void:
	MapBounds.set_bounds(-half_extent, half_extent)
	for r in _obstacles:
		var body := StaticBody2D.new()
		body.collision_layer = CollisionLayers.WORLD
		body.collision_mask = 0
		body.position = r.position + r.size * 0.5
		var cs := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size = r.size
		cs.shape = rect
		body.add_child(cs)
		add_child(body)
	queue_redraw()

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
	for r in _obstacles:
		draw_rect(r, obstacle_color)
		draw_rect(r, obstacle_border, false, 3.0)
