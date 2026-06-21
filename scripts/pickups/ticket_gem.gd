class_name TicketGem
extends Area2D
## Pooled XP pickup (08 §14). Layer PICKUP, mask 0 — the player's magnet scans it.

@onready var visual: Blob = $Visual

var value: int = 1
var _magnetized: bool = false
var _speed: float = 0.0

func _ready() -> void:
	collision_layer = CollisionLayers.PICKUP
	collision_mask = 0
	# Gems are spawned from inside enemy death — which runs during a projectile's
	# area_entered callback. Godot blocks monitoring/monitorable changes while
	# flushing physics queries, so these MUST be deferred or the magnet never
	# sees the gem (monitorable stays false).
	set_deferred(&"monitorable", true)
	set_deferred(&"monitoring", false)

func set_value(v: int) -> void:
	value = v
	if visual:
		# Bigger / warmer gems for higher value, for readability.
		visual.configure(Color(1.0, 0.85, 0.2).lerp(Color(1.0, 0.4, 0.1), clampf((v - 1) / 10.0, 0.0, 1.0)),
			3.0 + minf(float(v), 8.0) * 0.6, Blob.Shape.DIAMOND)

func magnetize() -> void:
	_magnetized = true

func _physics_process(delta: float) -> void:
	if _magnetized and is_instance_valid(GameState.player):
		_speed = minf(_speed + 1400.0 * delta, 900.0)
		global_position = global_position.move_toward(GameState.player.global_position, _speed * delta)
		if global_position.distance_to(GameState.player.global_position) < 12.0:
			_collect()

func _collect() -> void:
	EventBus.ticket_collected.emit(value)
	AudioManager.play_sfx(&"ticket_pickup")
	ObjectPool.release(self)

func _on_released() -> void:
	_magnetized = false
	_speed = 0.0
	hide()
	set_physics_process(false)
	set_deferred(&"monitorable", false)

func _on_acquired() -> void:
	show()
	set_physics_process(true)
	# Deferred: acquisition happens during the death/collision flush (see _ready).
	set_deferred(&"monitorable", true)
