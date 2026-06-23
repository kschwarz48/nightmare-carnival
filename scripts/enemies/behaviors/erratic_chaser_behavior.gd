extends EnemyBehavior
## Evil Clown (04). A fast chaser with a randomized heading wobble (hard to kite
## perfectly) and an occasional brief "honk-hop" speed burst.

var _jitter: float = 0.0
var _jitter_t: float = 0.0
var _burst_mult: float = 1.0
var _burst_t: float = 0.0

func setup(_enemy: Enemy) -> void:
	_jitter_t = randf_range(0.2, 0.5)
	_burst_t = randf_range(2.0, 4.0)

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	_jitter_t -= delta
	if _jitter_t <= 0.0:
		_jitter = randf_range(-0.6, 0.6)            # radians of heading wobble
		_jitter_t = randf_range(0.2, 0.5)
	_burst_t -= delta
	if _burst_t <= 0.0:
		if _burst_mult > 1.0:
			_burst_mult = 1.0
			_burst_t = randf_range(2.0, 4.0)
		else:
			_burst_mult = 1.3                        # short honk-hop (peak ~208 < player 220, so kiteable)
			_burst_t = randf_range(0.3, 0.4)
	var to := to_player(enemy).rotated(_jitter)
	enemy.steer(to, _burst_mult, 0.5)
