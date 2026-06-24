extends EnemyBehavior
## Jack-in-the-Box (04 ACT II): a placed trap. Sits and winds up (telegraph), then
## leaps at the player's locked position and pops. Kill it during the wind-up and
## it never goes off. Data-driven: arm_time, leap_speed, leap_time.

enum State { APPROACH, ARM, LEAP }

var _state: int = State.APPROACH
var _t: float = 0.0
var _dir: Vector2 = Vector2.ZERO

func setup(enemy: Enemy) -> void:
	_state = State.APPROACH
	_t = 0.0

func physics_update(enemy: Enemy, delta: float) -> void:
	_t -= delta
	match _state:
		State.APPROACH:
			# Creep in, then arm once close enough to the player.
			enemy.steer(to_player(enemy))
			if enemy.global_position.distance_to(GameState.player.global_position) < float(param(enemy, "arm_range", 220.0)):
				_state = State.ARM
				_t = float(param(enemy, "arm_time", 1.4))
		State.ARM:
			# Sit still and flash a winding telegraph.
			enemy.velocity = Vector2.ZERO
			enemy.visual.set_flash(0.5 + 0.5 * sin(_t * 18.0), Color(1, 0.9, 0.2))
			if _t <= 0.0:
				_dir = to_player(enemy)            # lock target
				_state = State.LEAP
				_t = float(param(enemy, "leap_time", 0.45))
				enemy.visual.set_flash(0.0)
		State.LEAP:
			enemy.velocity = _dir * float(param(enemy, "leap_speed", 520.0))
			enemy.move_and_slide()
			if _t <= 0.0:
				EnemyDirector.despawn(enemy)        # popped — gone (dodge = no boom)
