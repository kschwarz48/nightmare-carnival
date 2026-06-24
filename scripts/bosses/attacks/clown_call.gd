extends BossAttack
## Clown Call (05 P3): the maw bellows and summons a few elite Evil Clowns.

const CLOWN := preload("res://resources/enemies/evil_clown.tres")
const COUNT := 3

func _init() -> void:
	weight = 1.0
	cooldown = 1.2
	lead_time = 0.8

func execute(boss) -> void:
	for i in COUNT:
		EnemyDirector.spawn_add(CLOWN, boss.global_position + Vector2.from_angle(randf() * TAU) * randf_range(60.0, 160.0), true)
