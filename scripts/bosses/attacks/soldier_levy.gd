extends BossAttack
## Puppet King — Soldier Levy / Last Levy (05 P1/P3): summons a rank of Puppet
## Soldiers (doc 04).

const SOLDIER := preload("res://resources/enemies/puppet_soldier.tres")
const COUNT := 4

func _init() -> void:
	weight = 1.0
	cooldown = 1.3
	lead_time = 0.8

func execute(boss) -> void:
	for i in COUNT:
		EnemyDirector.spawn_add(SOLDIER, boss.global_position + Vector2.from_angle(randf() * TAU) * randf_range(90.0, 200.0))
