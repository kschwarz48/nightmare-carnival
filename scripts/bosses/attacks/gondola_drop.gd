extends BossAttack
## Ferris Wheel — Gondola Drop (05 P1/P3): gondolas crash at marked spots around
## the player (telegraph → slam), each leaving a Balloon cluster. Doubles as the
## P3 "Gondola Bombs". Reuses telegraph + shockwave + the swarm balloon adds.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const SHOCKWAVE := preload("res://scenes/bosses/shockwave.tscn")
const BALLOON := preload("res://resources/enemies/living_balloon.tres")
const COUNT := 4
const RADIUS := 90.0
const DMG := 22.0
const LEAD := 0.95

func _init() -> void:
	weight = 1.2
	cooldown = 1.1
	lead_time = 0.3

func execute(boss) -> void:
	var center: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
	var spots: Array[Vector2] = []
	for i in COUNT:
		var p := center + Vector2.from_angle(randf() * TAU) * randf_range(60.0, 300.0)
		spots.append(p)
		var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
		tel.global_position = p
		tel.call(&"show_telegraph", RADIUS, LEAD)
	await boss.get_tree().create_timer(LEAD, false).timeout
	if not boss._alive:
		return
	for p in spots:
		var sw := ObjectPool.acquire(SHOCKWAVE, boss.get_parent())
		sw.global_position = p
		sw.call(&"detonate", DMG, RADIUS)
		for i in 2:
			EnemyDirector.spawn_add(BALLOON, p + Vector2.from_angle(randf() * TAU) * 40.0)
