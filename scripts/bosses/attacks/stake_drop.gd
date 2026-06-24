extends BossAttack
## Stake Drop (05 P2): tent stakes rain at several marked spots around the player,
## then slam. Telegraph all spots together, then detonate together — read the
## field and stand in the gaps.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const SHOCKWAVE := preload("res://scenes/bosses/shockwave.tscn")
const COUNT := 6
const RADIUS := 75.0
const DMG := 20.0
const LEAD := 0.9

func _init() -> void:
	weight = 1.0
	cooldown = 1.0
	lead_time = 0.3

func execute(boss) -> void:
	var center: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
	var spots: Array[Vector2] = []
	for i in COUNT:
		var p := center + Vector2.from_angle(randf() * TAU) * randf_range(40.0, 260.0)
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
