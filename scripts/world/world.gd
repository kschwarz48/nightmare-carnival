extends Node2D
## The map (07 §3). Programmer-art Carnival Core: an open, bounded grid floor.
## Interior obstacles are intentionally omitted — steered (non-navmesh) enemies
## get stuck on them; cover/chokepoints return with real navigation later (03 §3).
## Real tilemaps/lighting arrive at M6.

@export var half_extent: Vector2 = Vector2(2200, 2200)
@export var grid_step: float = 128.0
@export var floor_color: Color = Color(0.09, 0.07, 0.12)
@export var grid_color: Color = Color(0.16, 0.13, 0.22)
@export var border_color: Color = Color(0.5, 0.2, 0.35)

func _ready() -> void:
	MapBounds.set_bounds(-half_extent, half_extent)
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
