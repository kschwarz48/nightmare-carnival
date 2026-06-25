extends BossAttack
## Ferris Wheel — The Roll (05 P2/P3): telegraphs a lane, then the wheel rolls
## across it at high speed — a giant moving wall. Dodge perpendicular. The boss
## moves itself here (it's _casting, so the base roam is suppressed).

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const ROLL_SPEED := 640.0
const DURATION := 1.3

func _init() -> void:
	weight = 1.6
	cooldown = 1.6
	lead_time = 1.2

func telegraph(boss, lead: float) -> void:
	var dir := Vector2.RIGHT
	if is_instance_valid(GameState.player):
		dir = boss.global_position.direction_to(GameState.player.global_position)
	boss.set_meta(&"_roll_dir", dir)
	# Mark the lane it will roll down.
	for i in 6:
		var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
		tel.global_position = boss.global_position + dir * (120.0 * float(i + 1))
		tel.call(&"show_telegraph", 90.0, lead)
	await boss.get_tree().create_timer(lead, false).timeout

func execute(boss) -> void:
	var dir: Vector2 = boss.get_meta(&"_roll_dir", Vector2.RIGHT)
	var t := DURATION
	var dt: float = boss.get_physics_process_delta_time()
	while t > 0.0 and boss._alive:
		boss.global_position = (boss.global_position + dir * ROLL_SPEED * dt).clamp(MapBounds.min_pos, MapBounds.max_pos)
		await boss.get_tree().physics_frame
		t -= dt
