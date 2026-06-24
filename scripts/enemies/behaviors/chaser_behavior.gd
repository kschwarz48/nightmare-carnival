extends EnemyBehavior
## Living Balloon, Possessed Stuffie, Cotton-Candy Slime (08 §11, 04).
## Steer straight at the player plus cheap separation so a crowd shimmers
## instead of stacking into one point. A gentle perpendicular bob adds life.

var _bob_phase: float = 0.0

func setup(_enemy: Enemy) -> void:
	_bob_phase = randf() * TAU

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	var to := to_player(enemy)
	_bob_phase += delta * 6.0
	var perp := to.orthogonal() * sin(_bob_phase) * 0.25
	enemy.steer((to + perp).normalized())
