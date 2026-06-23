extends BossAttack
## Concession Spew (05 P1): the maw spits a few weak adds near the player.

const BALLOON := preload("res://resources/enemies/living_balloon.tres")
const STUFFIE := preload("res://resources/enemies/possessed_stuffie.tres")
const COUNT := 5

func _init() -> void:
	weight = 1.0
	cooldown = 0.8
	lead_time = 0.7

func execute(boss) -> void:
	var center: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
	for i in COUNT:
		var ed: EnemyData = BALLOON if randf() < 0.7 else STUFFIE
		EnemyDirector.spawn_add(ed, center + Vector2.from_angle(randf() * TAU) * randf_range(80.0, 220.0))
