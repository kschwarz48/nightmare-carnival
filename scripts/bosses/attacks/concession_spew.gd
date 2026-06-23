extends BossAttack
## Concession Spew (05 P1): the maw SPITS a few weak adds out of the tent — they
## emerge at the boss and then chase, so they're never dumped on top of the player.

const BALLOON := preload("res://resources/enemies/living_balloon.tres")
const STUFFIE := preload("res://resources/enemies/possessed_stuffie.tres")
const COUNT := 5

func _init() -> void:
	weight = 1.0
	cooldown = 0.8
	lead_time = 0.7

func execute(boss) -> void:
	for i in COUNT:
		var ed: EnemyData = BALLOON if randf() < 0.7 else STUFFIE
		EnemyDirector.spawn_add(ed, boss.global_position + Vector2.from_angle(randf() * TAU) * randf_range(50.0, 130.0))
