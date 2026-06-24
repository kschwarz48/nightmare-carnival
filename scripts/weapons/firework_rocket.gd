extends Projectile
## Fireworks rocket (06 §2). Reuses the pooled Projectile for travel + lifetime,
## but lobs OVER the crowd (no contact hits) on a visible, decelerating arc and
## detonates a pooled Explosion AoE on fuse end — a different "shape of fire"
## from the cards.

const EXPLOSION_SCENE := preload("res://scenes/weapons/explosion.tscn")

## Speed profile across the flight: launches fast, eases toward the burst like a
## real mortar shell. The two multipliers average ~1.0 so total range (and thus
## where it explodes) matches the configured projectile speed.
const LAUNCH_MULT := 1.7
const BURST_MULT := 0.3

@onready var _visual: Node2D = $Visual

var _blast_area: float = 1.0
var _arc_height: float = 0.0
var _speed0: float = 0.0
var _speed1: float = 0.0

func launch(dir: Vector2, dmg: float, spd: float, area_scale: float,
		p_pierce: int, life: float, crit: bool, crit_dmg: float) -> void:
	super.launch(dir, dmg, spd, area_scale, p_pierce, life, crit, crit_dmg)
	# Keep the rocket small and unrotated so the arc lifts toward screen-up.
	_blast_area = area_scale
	scale = Vector2.ONE
	rotation = 0.0
	_arc_height = spd * life * 0.45      # peak lift scales with flight distance
	_speed0 = spd * LAUNCH_MULT
	_speed1 = spd * BURST_MULT
	speed = _speed0
	if _visual:
		_visual.position = Vector2.ZERO

func _physics_process(delta: float) -> void:
	if lifetime > 0.0:
		var progress := clampf(1.0 - _life / lifetime, 0.0, 1.0)
		# Decelerate out of the "tube" toward the burst.
		speed = lerpf(_speed0, _speed1, progress)
		# Parabolic visual lift: 0 at launch/impact, peak at mid-flight.
		if _visual:
			_visual.position.y = -_arc_height * 4.0 * progress * (1.0 - progress)
	super._physics_process(delta)

func _on_area_entered(_area: Area2D) -> void:
	pass   # lobs past enemies; the explosion does the damage

func _despawn() -> void:
	var ex := ObjectPool.acquire(EXPLOSION_SCENE, get_parent()) as Explosion
	ex.global_position = global_position
	ex.knockback_dealt = knockback_dealt
	ex.detonate(damage, _blast_area, is_crit, crit_damage)
	super._despawn()
