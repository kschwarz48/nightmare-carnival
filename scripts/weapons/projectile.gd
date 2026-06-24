class_name Projectile
extends Area2D
## Pooled player projectile (08 §8.3). Layer PLAYER_ATTACK, mask ENEMY_HURTBOX.

var direction: Vector2 = Vector2.RIGHT
var speed: float = 400.0
var damage: float = 10.0
var pierce: int = 0
var lifetime: float = 2.0
var is_crit: bool = false
var crit_damage: float = 2.0

var _life: float = 0.0
var _hit: Array = []     # hurtboxes already hit (no double-tap during pierce)

func _ready() -> void:
	collision_layer = CollisionLayers.PLAYER_ATTACK
	collision_mask = CollisionLayers.ENEMY_HURTBOX
	monitorable = false
	area_entered.connect(_on_area_entered)

func launch(dir: Vector2, dmg: float, spd: float, area_scale: float,
		p_pierce: int, life: float, crit: bool, crit_dmg: float) -> void:
	direction = dir.normalized()
	damage = dmg
	speed = spd
	pierce = p_pierce
	lifetime = life
	is_crit = crit
	crit_damage = crit_dmg
	_life = lifetime
	_hit.clear()
	rotation = direction.angle()
	scale = Vector2.ONE * area_scale
	monitoring = true
	show()

func _physics_process(delta: float) -> void:
	global_position += direction * speed * delta
	_life -= delta
	if _life <= 0.0:
		_despawn()

func _on_area_entered(area: Area2D) -> void:
	if area is HurtboxComponent and not _hit.has(area):
		_hit.append(area)
		var dmg := damage * (crit_damage if is_crit else 1.0)
		area.receive(DamageInfo.new(dmg, self, is_crit))
		if pierce <= 0:
			_despawn()
		else:
			pierce -= 1

func _despawn() -> void:
	# _despawn can fire from _on_area_entered (a collision callback) where Area2D
	# flag changes and remove_child are blocked — defer both. (Idempotent release.)
	set_deferred(&"monitoring", false)
	ObjectPool.call_deferred(&"release", self)

# Pool hooks
func _on_released() -> void:
	set_deferred(&"monitoring", false)
	hide()
	set_physics_process(false)

func _on_acquired() -> void:
	set_physics_process(true)
