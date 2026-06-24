extends EnemyBehavior
## Roller-Coaster Snake (04 ACT IV): a fast strafing serpent. Instead of chasing
## the player directly, it picks a point just PAST the player and rails toward it
## at speed, weaving by on a new line each pass — fast, hard to face-tank, but
## dodgeable by stepping off its rail. (Segmented body visual is M6 art.)
## Data-driven: strafe_speed, retarget_time, overshoot.

var _t: float = 0.0
var _target: Vector2 = Vector2.ZERO

func setup(enemy: Enemy) -> void:
	_retarget(enemy)

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	_t -= delta
	if _t <= 0.0 or enemy.global_position.distance_to(_target) < 70.0:
		_retarget(enemy)
	enemy.velocity = enemy.global_position.direction_to(_target) * float(param(enemy, "strafe_speed", 250.0))
	enemy.move_and_slide()

func _retarget(enemy: Enemy) -> void:
	_t = float(param(enemy, "retarget_time", 1.4))
	# Aim past the player along a perpendicular offset so it rails by, not into.
	var to := to_player(enemy)
	var side := 1.0 if randf() < 0.5 else -1.0
	var over := float(param(enemy, "overshoot", 260.0))
	_target = GameState.player.global_position + to * over + to.orthogonal() * side * randf_range(120.0, 320.0)
