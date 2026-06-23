extends Area2D
## Pooled boss projectile (Popcorn Exhale). Layer ENEMY_ATTACK, mask
## PLAYER_HURTBOX — straight shot that damages the player and despawns.

@onready var visual: Blob = $Visual

var _dir: Vector2 = Vector2.RIGHT
var _speed: float = 260.0
var _dmg: float = 16.0
var _life: float = 0.0

func _ready() -> void:
	collision_layer = CollisionLayers.ENEMY_ATTACK
	collision_mask = CollisionLayers.PLAYER_HURTBOX
	monitorable = false
	area_entered.connect(_on_area_entered)

func launch(dir: Vector2, dmg: float, spd: float, life: float) -> void:
	_dir = dir.normalized()
	_dmg = dmg
	_speed = spd
	_life = life
	monitoring = true
	show()

func _physics_process(delta: float) -> void:
	global_position += _dir * _speed * delta
	_life -= delta
	if _life <= 0.0:
		_despawn()

func _on_area_entered(a: Area2D) -> void:
	if a is HurtboxComponent:
		a.receive(DamageInfo.new(_dmg, self, false))
		_despawn()

func _despawn() -> void:
	# Can fire from _on_area_entered (hit) — defer the flag change + release.
	set_deferred(&"monitoring", false)
	ObjectPool.call_deferred(&"release", self)

func _on_acquired() -> void:
	set_physics_process(true)

func _on_released() -> void:
	set_deferred(&"monitoring", false)
	hide()
	set_physics_process(false)
