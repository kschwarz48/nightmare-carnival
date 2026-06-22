class_name FoodPickup
extends Area2D
## Rare healing pickup — hot dog / funnel cake (03 §6). Pooled. Layer PICKUP;
## the player's magnet scans it (we expose magnetize()). Bright green + pulsing
## so it's easy to spot, and despawns after a window so uncollected food doesn't
## litter the field.

@export var heal_amount: float = 20.0
@export var lifetime: float = 45.0

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
		if global_position.distance_to(GameState.player.global_position) < 14.0:
			_collect()

func _process(delta: float) -> void:
	# Pulse so it reads as a "grab me" beacon among the chaos.
	_pulse += delta
	if visual:
		var s := 1.0 + 0.18 * sin(_pulse * 5.0)
		visual.scale = Vector2(s, s)

func _collect() -> void:
	if is_instance_valid(GameState.player):
		(GameState.player as Player).health.heal(heal_amount)
	AudioManager.play_sfx(&"heal")
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
