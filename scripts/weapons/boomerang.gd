extends Projectile
## Ring Toss boomerang (06 §2). Flies out (easing to an apex), then curves back
## to the player, piercing everything — and can re-hit on the way back. A
## different "shape of fire": out-and-back zone control rather than a straight shot.

var _returning: bool = false

func launch(dir: Vector2, dmg: float, spd: float, area_scale: float,
		p_pierce: int, life: float, crit: bool, crit_dmg: float) -> void:
	super.launch(dir, dmg, spd, area_scale, p_pierce, life, crit, crit_dmg)
	pierce = 1_000_000          # never despawn on hit; it lives its full arc
	_returning = false

func _physics_process(delta: float) -> void:
	if lifetime <= 0.0:
		_despawn()
		return
	_life -= delta
	var t := clampf(1.0 - _life / lifetime, 0.0, 1.0)
	if t < 0.5:
		# Outward, decelerating toward the apex.
		global_position += direction * speed * delta * lerpf(1.2, 0.2, t * 2.0)
	else:
		if not _returning:
			_returning = true
			_hit.clear()        # allow a second hit on the return pass
		if is_instance_valid(GameState.player):
			var to := global_position.direction_to(GameState.player.global_position)
			global_position += to * speed * delta * lerpf(0.4, 1.4, (t - 0.5) * 2.0)
			if global_position.distance_to(GameState.player.global_position) < 24.0:
				_despawn()
				return
	if _life <= 0.0:
		_despawn()
