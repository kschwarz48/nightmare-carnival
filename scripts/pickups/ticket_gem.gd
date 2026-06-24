class_name TicketGem
extends Area2D
## Pooled XP pickup (08 §14). Layer PICKUP, mask 0 — the player's magnet scans it.

@onready var visual: Blob = $Visual

var value: int = 1
var is_bank: bool = false        # the single "Red Gem Bank" gem (03 §6)
var _magnetized: bool = false
var _speed: float = 0.0
var _pulse: float = 0.0

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
	if not visual:
		return
	# Color is keyed to payout, VS-style (03 §6): blue = 1, green = a few, red = a
	# lot (elites and the bank). The XP bar shares the blue->green family.
	var col: Color
	if v >= 5:
		col = Color(1.0, 0.25, 0.3)         # red — big payout
	elif v >= 2:
		col = Color(0.3, 0.95, 0.45)        # green — medium
	else:
		col = Color(0.3, 0.6, 1.0)          # blue — 1 XP
	var r: float = 14.0 if is_bank else 3.0 + minf(float(v), 12.0) * 0.5
	visual.configure(col, r, Blob.Shape.DIAMOND)

## Promote this gem to the Red Gem Bank — overflow XP accumulates here.
func make_bank() -> void:
	is_bank = true
	set_value(value)

func add_to_bank(v: int) -> void:
	value += v
	set_value(value)

func magnetize() -> void:
	_magnetized = true

func _physics_process(delta: float) -> void:
	if is_bank and not _magnetized and visual:
		_pulse += delta
		visual.scale = Vector2.ONE * (1.0 + 0.2 * sin(_pulse * 5.0))
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
	GemDirector.on_gem_freed(self)
	remove_from_group(&"xp_gems")
	is_bank = false
	_pulse = 0.0
	_magnetized = false
	_speed = 0.0
	hide()
	if visual:
		visual.scale = Vector2.ONE
	set_physics_process(false)
	set_deferred(&"monitorable", false)

func _on_acquired() -> void:
	show()
	add_to_group(&"xp_gems")          # so the Golden Ticket can vacuum every gem
	set_physics_process(true)
	# Deferred: acquisition happens during the death/collision flush (see _ready).
	set_deferred(&"monitorable", true)
