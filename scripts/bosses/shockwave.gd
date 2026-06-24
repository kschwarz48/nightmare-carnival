class_name Shockwave
extends Area2D
## Pooled boss AoE — the Explosion pattern with flipped layers so it damages the
## PLAYER. Layer ENEMY_ATTACK, mask PLAYER_HURTBOX. Hits once, fades, releases.

const LIFE := 0.25

@onready var visual: Blob = $Visual
@onready var shape: CollisionShape2D = $CollisionShape2D

var _dmg: float = 0.0
var _t: float = 0.0
var _live: bool = false
var _hit: Array = []

func _ready() -> void:
	collision_layer = CollisionLayers.ENEMY_ATTACK
	collision_mask = CollisionLayers.PLAYER_HURTBOX
	monitorable = false
	area_entered.connect(_on_area_entered)

func detonate(damage: float, radius: float) -> void:
	_dmg = damage
	_hit.clear()
	(shape.shape as CircleShape2D).radius = radius   # shape is resource_local_to_scene
	visual.configure(Color(1.0, 0.5, 0.15, 0.7), radius)
	_t = LIFE
	_live = true
	modulate.a = 1.0
	monitoring = true
	set_process(true)
	await get_tree().physics_frame
	# physics_frame still fires while paused — don't land the hit mid-pause.
	while GameState.is_paused:
		await get_tree().physics_frame
	if not _live or not is_instance_valid(self):
		return
	for a in get_overlapping_areas():
		_try_hit(a)

func _on_area_entered(a: Area2D) -> void:
	if _live:
		_try_hit(a)

func _try_hit(a: Area2D) -> void:
	if a is HurtboxComponent and not _hit.has(a):
		_hit.append(a)
		a.receive(DamageInfo.new(_dmg, self, false))

func _process(delta: float) -> void:
	_t -= delta
	modulate.a = clampf(_t / LIFE, 0.0, 1.0)
	if _t <= 0.0:
		_release()

func _release() -> void:
	_live = false
	set_deferred(&"monitoring", false)
	ObjectPool.release(self)

func _on_acquired() -> void:
	show()
	modulate.a = 1.0
	set_process(false)

func _on_released() -> void:
	_live = false
	_hit.clear()
	hide()
	set_process(false)
	set_deferred(&"monitoring", false)
