class_name OrbitOrb
extends Area2D
## One Crystal Orb / "bible" (08 §8 "orbit"). Persistent damaging body positioned
## by OrbitWeapon. Layer PLAYER_ATTACK, mask ENEMY_HURTBOX.
##
## Hitbox delay (King Bible rule): the same enemy can't be hit more often than
## every HIT_DELAY by THIS orb — but all of an orb's active delays reset together
## the instant any one elapses, so clustered enemies can get hit a bit more often.

const HIT_DELAY := 1.7

@onready var visual: Blob = $Visual
@onready var shape: CollisionShape2D = $CollisionShape2D

var _dmg: float = 10.0
var knockback_dealt: float = 0.0  # set by OrbitWeapon
var _cool: Dictionary = {}        # HurtboxComponent -> seconds until hittable again
var _t: float = 0.0
var _hue: float = 0.0             # gradient phase offset (per orb)

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER_ATTACK
	collision_mask = CollisionLayers.ENEMY_HURTBOX
	monitoring = true
	monitorable = false
	area_entered.connect(_try_hit)

func setup(radius: float) -> void:
	(shape.shape as CircleShape2D).radius = radius
	if visual:
		visual.radius = radius

func set_damage(d: float) -> void:
	_dmg = d

func set_knockback(k: float) -> void:
	knockback_dealt = k

func set_hue(h: float) -> void:
	_hue = h

func _physics_process(delta: float) -> void:
	# Shared-reset cooldowns: tick all, and if ANY has elapsed, clear them ALL.
	if not _cool.is_empty():
		var any_elapsed := false
		for k in _cool.keys():
			_cool[k] -= delta
			if _cool[k] <= 0.0:
				any_elapsed = true
		if any_elapsed:
			_cool.clear()
	for a in get_overlapping_areas():
		_try_hit(a)
	# Shifting gradient so it clearly reads as a magic weapon, not a pickup.
	_t += delta
	if visual:
		visual.color = Color.from_hsv(fmod(_t * 0.35 + _hue, 1.0), 0.65, 1.0, 0.9)
		visual.queue_redraw()

func _try_hit(a: Area2D) -> void:
	if a is HurtboxComponent and not _cool.has(a):
		_cool[a] = HIT_DELAY
		(a as HurtboxComponent).receive(DamageInfo.new(_dmg, self, false, knockback_dealt))
