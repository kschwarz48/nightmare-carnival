extends EnemyBehavior
## Balloon Swarm (04). A cross-screen "dodge this": moves straight in a fixed
## direction (set per-spawn by the director via the "flyby_dir" meta), passes
## THROUGH the persistent crowd, and despawns once it exits the far edge. Never
## chases. Non-persistent — no ticket drop on despawn (it isn't a kill).

const MAX_LIFE := 8.0   # safety despawn so a stray never lingers

var _life: float = 0.0

func setup(enemy: Enemy) -> void:
	_life = 0.0
	# No body collision at all: layer 0 so the fast swarm doesn't shove the crowd
	# along with it, mask 0 so it never snags on geometry. Its hurtbox/hitbox
	# Area2Ds are separate, so it's still killable and still deals contact.
	enemy.collision_layer = 0
	enemy.collision_mask = 0

func physics_update(enemy: Enemy, delta: float) -> void:
	_life += delta
	var dir: Vector2 = enemy.get_meta(&"flyby_dir", Vector2.RIGHT)
	enemy.velocity = dir * enemy.move_speed
	enemy.move_and_slide()
	if _life > MAX_LIFE or EnemyDirector.past_screen(enemy.global_position, dir):
		EnemyDirector.despawn(enemy)
