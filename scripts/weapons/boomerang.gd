extends Projectile
## Ring Toss boomerang (06 §2). Flies out toward the aimed enemy, eases to an
## apex, curves back and homes through the player — then keeps that heading and
## flies straight out the far side and off-screen. Pierces everything and can
## re-hit on each pass. A different "shape of fire": an out-and-through sweep.

enum Stage { OUT, BACK, THROUGH }

var _stage: int = Stage.OUT
var _through_dir: Vector2 = Vector2.ZERO

func launch(dir: Vector2, dmg: float, spd: float, area_scale: float,
		p_pierce: int, life: float, crit: bool, crit_dmg: float) -> void:
	super.launch(dir, dmg, spd, area_scale, p_pierce, life, crit, crit_dmg)
	pierce = 1_000_000          # never despawn on hit; it lives its full arc
	_stage = Stage.OUT
	_through_dir = Vector2.ZERO

func _physics_process(delta: float) -> void:
	if lifetime <= 0.0:
		_despawn()
		return
	_life -= delta
	if _life <= 0.0:
		_despawn()
		return
	var t := clampf(1.0 - _life / lifetime, 0.0, 1.0)
	match _stage:
		Stage.OUT:
			# Outward, decelerating toward the apex (first ~40% of life).
			global_position += direction * speed * delta * lerpf(1.2, 0.2, clampf(t / 0.4, 0.0, 1.0))
			if t >= 0.4:
				_stage = Stage.BACK
				_hit.clear()        # allow a fresh hit on the way back
		Stage.BACK:
			# Home back toward the player, accelerating.
			if is_instance_valid(GameState.player):
				var to := global_position.direction_to(GameState.player.global_position)
				global_position += to * speed * delta * 1.3
				if global_position.distance_to(GameState.player.global_position) < 28.0:
					# Passed through the player — keep heading, fly out the far side.
					_through_dir = to
					_stage = Stage.THROUGH
					_hit.clear()
			else:
				_through_dir = -direction
				_stage = Stage.THROUGH
		Stage.THROUGH:
			global_position += _through_dir * speed * delta * 1.3
