class_name SpatialHash
extends RefCounted
## Uniform-grid spatial hash for near-O(n) neighbor lookups (08 §12).
## Rebuilt once per physics frame by the director; used for cheap separation.

var cell_size: float = 48.0
var _grid: Dictionary = {}     # Vector2i -> Array[Node2D]

func _key(pos: Vector2) -> Vector2i:
	return Vector2i(floori(pos.x / cell_size), floori(pos.y / cell_size))

func rebuild(nodes: Array) -> void:
	_grid.clear()
	for n in nodes:
		if not is_instance_valid(n):
			continue
		var k := _key(n.global_position)
		if not _grid.has(k):
			_grid[k] = []
		_grid[k].append(n)

## Neighbors in the 3x3 block of cells around pos.
func query(pos: Vector2) -> Array:
	var out: Array = []
	var base := _key(pos)
	for dx in range(-1, 2):
		for dy in range(-1, 2):
			var cell: Array = _grid.get(base + Vector2i(dx, dy), [])
			out.append_array(cell)
	return out
