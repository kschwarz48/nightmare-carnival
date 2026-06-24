class_name OrbitOrb
extends Area2D
## One Crystal Orb (08 §8 "orbit"). Persistent damaging body that orbits the
## player (positioned by OrbitWeapon). Layer PLAYER_ATTACK, mask ENEMY_HURTBOX.
## Grinds the crowd: re-hits each enemy on a short interval rather than deleting
## on contact, so it's continuous zone damage.

const REHIT := 0.4

@onready var visual: Blob = $Visual
@onready var shape: CollisionShape2D = $CollisionShape2D

var _dmg: float = 10.0
var _cool: Dictionary = {}        # HurtboxComponent -> seconds until it can be hit again

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER_ATTACK
	collision_mask = CollisionLayers.ENEMY_HURTBOX
	monitoring = true
	monitorable = false
	area_entered.connect(_try_hit)

func setup(area_scale: float) -> void:
	var r := 13.0 * area_scale
	(shape.shape as CircleShape2D).radius = r
	visual.configure(Color(0.6, 0.85, 1.0, 0.9), r)

func set_damage(d: float) -> void:
	_dmg = d

func _physics_process(delta: float) -> void:
	for k in _cool.keys():
		_cool[k] -= delta
		if _cool[k] <= 0.0:
			_cool.erase(k)
	for a in get_overlapping_areas():
		_try_hit(a)

func _try_hit(a: Area2D) -> void:
	if a is HurtboxComponent and not _cool.has(a):
		_cool[a] = REHIT
		(a as HurtboxComponent).receive(DamageInfo.new(_dmg, self, false))
