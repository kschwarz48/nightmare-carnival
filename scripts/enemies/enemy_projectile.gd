extends Area2D
## Generic pooled enemy projectile (08 §11). Layer ENEMY_ATTACK, mask
## PLAYER_HURTBOX — a straight shot that damages the player and despawns. Used by
## ranged enemy behaviors (shooter, etc.); the boss has its own themed Popcorn.

@onready var visual: Blob = $Visual

var _dir: Vector2 = Vector2.RIGHT
var _speed: float = 220.0
var _dmg: float = 8.0
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
	if GameState.is_paused:
		return
	global_position += _dir * _speed * delta
	_life -= delta
	if _life <= 0.0 or EnemyDirector.past_screen(global_position, _dir):
		_despawn()

func _on_area_entered(a: Area2D) -> void:
	if a is HurtboxComponent:
		(a as HurtboxComponent).receive(DamageInfo.new(_dmg, self, false))
		_despawn()

func _despawn() -> void:
	# Can fire from _on_area_entered (a query flush) — defer the flag + release.
	set_deferred(&"monitoring", false)
	ObjectPool.call_deferred(&"release", self)

func _on_acquired() -> void:
	set_physics_process(true)

func _on_released() -> void:
	set_deferred(&"monitoring", false)
	hide()
	set_physics_process(false)
