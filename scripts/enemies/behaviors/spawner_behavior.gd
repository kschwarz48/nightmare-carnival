extends EnemyBehavior
## Walking Ticket Booth (04 ACT III): a slow tank that plods at the player and
## periodically spits out adds. Data-driven via EnemyData.params:
##   spawn_interval, spawn_count, spawn_enemy (EnemyData id).

var _t: float = 0.0

func setup(enemy: Enemy) -> void:
	_t = float(param(enemy, "spawn_interval", 4.0)) * randf()

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	enemy.steer(to_player(enemy))
	_t -= delta
	if _t <= 0.0:
		_t = float(param(enemy, "spawn_interval", 4.0))
		var ed := ContentDB.get_enemy(param(enemy, "spawn_enemy", &""))
		if ed != null:
			for i in int(param(enemy, "spawn_count", 2)):
				EnemyDirector.spawn_add(ed, enemy.global_position + Vector2.from_angle(randf() * TAU) * 44.0)
