extends EnemyBehavior
## Whack-a-Mole (04 ACT II/III): burrows toward the player (hidden + invulnerable),
## surfaces to swipe (vulnerable), then re-burrows to reposition. Only killable
## while surfaced. Data-driven: burrow_time, surface_time, burrow_speed.

enum State { BURROW, SURFACE }

var _state: int = State.SURFACE
var _t: float = 0.0

func setup(enemy: Enemy) -> void:
	_enter_burrow(enemy)

func physics_update(enemy: Enemy, delta: float) -> void:
	if GameState.player == null:
		return
	_t -= delta
	match _state:
		State.BURROW:
			# Move fast underground toward the player; can't be hit or hit you.
			enemy.velocity = to_player(enemy) * float(param(enemy, "burrow_speed", 180.0))
			enemy.move_and_slide()
			if _t <= 0.0:
				_enter_surface(enemy)
		State.SURFACE:
			enemy.velocity = Vector2.ZERO
			if _t <= 0.0:
				_enter_burrow(enemy)

func _enter_burrow(enemy: Enemy) -> void:
	_state = State.BURROW
	_t = float(param(enemy, "burrow_time", 1.6))
	enemy.visual.visible = false
	enemy.hurtbox.set_deferred(&"monitorable", false)   # invulnerable underground
	enemy.hitbox.set_deferred(&"monitoring", false)

func _enter_surface(enemy: Enemy) -> void:
	_state = State.SURFACE
	_t = float(param(enemy, "surface_time", 1.4))
	enemy.visual.visible = true
	enemy.hurtbox.set_deferred(&"monitorable", true)
	enemy.hitbox.set_deferred(&"monitoring", true)
