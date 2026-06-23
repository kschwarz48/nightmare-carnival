extends Boss
## The Carnival Tent (05 BOSS 1). Three phases of curated attacks, plus a soft
## set-piece arena (StaticBody2D walls) that forms around the player on spawn and
## clears on defeat (03 §8).

const ARENA_HALF := Vector2(900.0, 620.0)
const WALL_THICK := 48.0

var _arena: Node2D

func _build_phases() -> Array[BossPhase]:
	var p1 := BossPhase.new()
	p1.hp_threshold = 1.0
	p1.attacks = [
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/concession_spew.gd").new(),
	]
	var p2 := BossPhase.new()
	p2.hp_threshold = 0.6
	p2.attacks = [
		preload("res://scripts/bosses/attacks/inhale.gd").new(),
		preload("res://scripts/bosses/attacks/popcorn_exhale.gd").new(),
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),
	]
	var p3 := BossPhase.new()
	p3.hp_threshold = 0.3
	p3.attacks = [
		preload("res://scripts/bosses/attacks/frenzy_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/clown_call.gd").new(),
	]
	var out: Array[BossPhase] = [p1, p2, p3]
	return out

func _on_spawn() -> void:
	var center: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else global_position
	_arena = _make_arena(center)
	get_parent().add_child(_arena)
	# Set-piece: the tent looms at the top of the arena.
	global_position = center + Vector2(0.0, -ARENA_HALF.y + 140.0)

func _on_despawn() -> void:
	if is_instance_valid(_arena):
		_arena.queue_free()

func _make_arena(center: Vector2) -> Node2D:
	var root := Node2D.new()
	root.global_position = center
	var defs := [
		[Vector2(0, -ARENA_HALF.y), Vector2(ARENA_HALF.x * 2.0 + WALL_THICK, WALL_THICK)],
		[Vector2(0, ARENA_HALF.y), Vector2(ARENA_HALF.x * 2.0 + WALL_THICK, WALL_THICK)],
		[Vector2(-ARENA_HALF.x, 0), Vector2(WALL_THICK, ARENA_HALF.y * 2.0 + WALL_THICK)],
		[Vector2(ARENA_HALF.x, 0), Vector2(WALL_THICK, ARENA_HALF.y * 2.0 + WALL_THICK)],
	]
	for d in defs:
		var body := StaticBody2D.new()
		body.collision_layer = CollisionLayers.WORLD
		body.collision_mask = 0
		body.position = d[0]
		var cs := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size = d[1]
		cs.shape = rect
		body.add_child(cs)
		root.add_child(body)
	return root
