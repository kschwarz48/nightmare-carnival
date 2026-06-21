extends EnemyBehavior
## Wind-Up Monkey (04, 08 §11). Creep in slowly, telegraph a wind-up, then
## burst-dash at the player's locked-in position, then recover. The first
## "timing" enemy — teaches reading a wind-up. All tuning in EnemyData.params.

enum State { APPROACH, WINDUP, CHARGE, RECOVER }

var _state: int = State.APPROACH
var _t: float = 0.0
var _dir: Vector2 = Vector2.RIGHT

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	var p: Dictionary = enemy.data.params
	var windup_time: float = p.get("windup_time", 0.6)
	var charge_speed: float = p.get("charge_speed", 185.0)
	var charge_time: float = p.get("charge_time", 0.4)
	var recover_time: float = p.get("recover_time", 0.7)
	var charge_range: float = p.get("charge_range", 260.0)

	match _state:
		State.APPROACH:
			enemy.velocity = to_player(enemy) * enemy.move_speed \
				+ enemy.separation() * enemy.move_speed * 0.4
			enemy.move_and_slide()
			if enemy.global_position.distance_to(GameState.player.global_position) < charge_range:
				_state = State.WINDUP
				_t = windup_time
		State.WINDUP:
			enemy.velocity = Vector2.ZERO
			# Telegraph: strobe the programmer-art blob (stands in for attack_windup).
			enemy.visual.set_flash(0.5 + 0.5 * sin(_t * 28.0))
			_t -= delta
			if _t <= 0.0:
				enemy.visual.set_flash(0.0)
				_dir = to_player(enemy)          # lock direction at end of wind-up
				_state = State.CHARGE
				_t = charge_time
		State.CHARGE:
			enemy.velocity = _dir * charge_speed
			enemy.move_and_slide()
			_t -= delta
			if _t <= 0.0:
				_state = State.RECOVER
				_t = recover_time
		State.RECOVER:
			enemy.velocity = enemy.velocity.lerp(Vector2.ZERO, 0.15)
			enemy.move_and_slide()
			_t -= delta
			if _t <= 0.0:
				_state = State.APPROACH
