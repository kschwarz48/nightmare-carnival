extends Node
## Tiny shared store for the playable map rectangle (referenced by 08 §13 director).
## world.tscn sets these on ready; the director clamps spawns into them.

var min_pos: Vector2 = Vector2(-2000, -2000)
var max_pos: Vector2 = Vector2(2000, 2000)

func set_bounds(p_min: Vector2, p_max: Vector2) -> void:
	min_pos = p_min
	max_pos = p_max

func center() -> Vector2:
	return (min_pos + max_pos) * 0.5
