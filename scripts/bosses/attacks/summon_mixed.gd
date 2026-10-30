extends BossAttack
## Ringmaster — Top Hat Trick / Summon the Carnival (05 P1/P3): pulls a mixed
## burst of enemies from across the roster, occasionally an elite.

const POOL := [
	preload("res://resources/enemies/evil_clown.tres"),
	preload("res://resources/enemies/possessed_stuffie.tres"),
	preload("res://resources/enemies/puppet_soldier.tres"),
	preload("res://resources/enemies/wind_up_monkey.tres"),
]
const COUNT := 5

func _init() -> void:
	weight = 1.0
	cooldown = 1.3
	lead_time = 0.8

func execute(boss) -> void:
	for i in COUNT:
		var ed: EnemyData = POOL.pick_random()
		EnemyDirector.spawn_add(ed, boss.global_position + Vector2.from_angle(randf() * TAU) * randf_range(100.0, 220.0), randf() < 0.2)
