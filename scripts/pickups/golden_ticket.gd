class_name GoldenTicket
extends Area2D
## Rare "wormhole" pickup (03 §6). Collecting it VACUUMS every XP gem on the map
## (including the Red Gem Bank) to the player at once — a big, satisfying sweep.
## Much rarer than food. Pooled; the player's magnet scans it (magnetize()).

@export var lifetime: float = 30.0
const ASPECT := Vector2(1.7, 0.9)        # wide so it reads as a ticket, not a coin

@onready var visual: Blob = $Visual

var _magnetized: bool = false
var _speed: float = 0.0
var _life: float = 0.0
var _pulse: float = 0.0

func _ready() -> void:
	collision_layer = CollisionLayers.PICKUP
	collision_mask = 0
	set_deferred(&"monitorable", true)
	set_deferred(&"monitoring", false)

func magnetize() -> void:
	_magnetized = true

func _physics_process(delta: float) -> void:
	_life -= delta
	if _life <= 0.0:
		ObjectPool.release(self)
		return
	if _magnetized and is_instance_valid(GameState.player):
		_speed = minf(_speed + 1400.0 * delta, 900.0)
		global_position = global_position.move_toward(GameState.player.global_position, _speed * delta)
		if global_position.distance_to(GameState.player.global_position) < 16.0:
			_collect()

func _process(delta: float) -> void:
	_pulse += delta
	if visual:
		visual.scale = ASPECT * (1.0 + 0.16 * sin(_pulse * 5.0))

func _collect() -> void:
	# Vacuum every active XP gem (incl. the bank) toward the player.
	for g in get_tree().get_nodes_in_group(&"xp_gems"):
		if is_instance_valid(g):
			(g as Node).call(&"magnetize")
	AudioManager.play_sfx(&"golden_ticket")
	ObjectPool.release(self)

func _on_acquired() -> void:
	show()
	_magnetized = false
	_speed = 0.0
	_life = lifetime
	_pulse = 0.0
	set_physics_process(true)
	set_process(true)
	set_deferred(&"monitorable", true)

func _on_released() -> void:
	hide()
	_magnetized = false
	set_physics_process(false)
	set_process(false)
	set_deferred(&"monitorable", false)
