extends BossAttack
## Ferris Wheel — Stampede Call (05 P3): summons a charge of Carousel Horses.

const HORSE := preload("res://resources/enemies/carousel_horse.tres")
const COUNT := 4

func _init() -> void:
	weight = 1.0
	cooldown = 1.2
	lead_time = 0.8

func execute(boss) -> void:
	for i in COUNT:
		EnemyDirector.spawn_add(HORSE, boss.global_position + Vector2.from_angle(randf() * TAU) * randf_range(90.0, 200.0))
