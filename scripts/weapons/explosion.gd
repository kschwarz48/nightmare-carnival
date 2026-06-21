class_name Explosion
extends Area2D
## Pooled one-shot AoE burst (06 §2, 08 §16). Layer PLAYER_ATTACK, mask
## ENEMY_HURTBOX. Damages every enemy hurtbox in radius once, shows an expanding
## fading pop, then returns to the pool.

const BASE_RADIUS := 48.0
const LIFE := 0.22

@onready var visual: Blob = $Visual
@onready var shape: CollisionShape2D = $CollisionShape2D

var _hit: Array = []
var _dmg: float = 0.0
var _crit: bool = false
var _t: float = 0.0
var _live: bool = false

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER_ATTACK
	collision_mask = CollisionLayers.ENEMY_HURTBOX
	monitorable = false
	area_entered.connect(_on_area_entered)

func detonate(damage: float, area_scale: float, crit: bool, crit_dmg: float) -> void:
	_hit.clear()
	_dmg = damage * (crit_dmg if crit else 1.0)
	_crit = crit
	var radius := BASE_RADIUS * area_scale
	(shape.shape as CircleShape2D).radius = radius   # shape is resource_local_to_scene
	visual.configure(visual.color, radius)
	_t = LIFE
	_live = true
	modulate.a = 1.0
	monitoring = true
	set_process(true)
	# area_entered only fires for enemies entering AFTER monitoring turns on; catch
	# those already inside the blast after one physics frame registers overlaps.
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
		a.receive(DamageInfo.new(_dmg, self, _crit))

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
