extends EnemyBehavior
## Ranged enemy (08 §11, doc 04). Kites the player — closes to ~keep_distance,
## backs off if too close — and fires an EnemyProjectile on an interval. Fully
## data-driven via EnemyData.params:
##   fire_interval, projectile_speed, projectile_damage, projectile_lifetime,
##   keep_distance.

const PROJ := preload("res://scenes/enemies/enemy_projectile.tscn")

var _fire_t: float = 0.0

func setup(enemy: Enemy) -> void:
	# Desync so a wave of shooters doesn't volley in lockstep.
	_fire_t = _f(enemy, "fire_interval", 1.5) * randf()

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	var to := to_player(enemy)
	var keep := _f(enemy, "keep_distance", 320.0)
	var dist := enemy.global_position.distance_to(GameState.player.global_position)
	var dir := to
	if dist < keep * 0.8:
		dir = -to                      # too close — retreat
	elif dist < keep:
		dir = Vector2.ZERO             # in the pocket — hold and shoot
	enemy.steer(dir)
	_fire_t -= delta
	if _fire_t <= 0.0:
		_fire_t = _f(enemy, "fire_interval", 1.5)
		_fire(enemy, to)

func _fire(enemy: Enemy, dir: Vector2) -> void:
	var proj := ObjectPool.acquire(PROJ, GameState.projectile_layer)
	proj.global_position = enemy.global_position
	proj.call(&"launch", dir,
		_f(enemy, "projectile_damage", 8.0),
		_f(enemy, "projectile_speed", 220.0),
		_f(enemy, "projectile_lifetime", 4.0))

func _f(enemy: Enemy, key: String, default_value: float) -> float:
	return float(enemy.data.params.get(key, default_value))
