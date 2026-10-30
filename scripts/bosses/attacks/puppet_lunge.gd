extends BossAttack
## Puppet King — Free Lunge (05 P3): the freed King crouches, then lunges across
## the stage at the player at high speed (a giant erratic clown). The boss drives
## its own movement here (it's _casting, so the base roam is suppressed).

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const LUNGE_SPEED := 720.0
const DURATION := 0.42

func _init() -> void:
	weight = 1.6
	cooldown = 0.7
	lead_time = 0.5

func telegraph(boss, lead: float) -> void:
	var dir := Vector2.RIGHT
	if is_instance_valid(GameState.player):
		dir = boss.global_position.direction_to(GameState.player.global_position)
	boss.set_meta(&"_lunge_dir", dir)
	var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
	tel.global_position = boss.global_position + dir * 160.0
	tel.call(&"show_telegraph", 120.0, lead)
	await boss.get_tree().create_timer(lead, false).timeout

func execute(boss) -> void:
	var dir: Vector2 = boss.get_meta(&"_lunge_dir", Vector2.RIGHT)
	var t := DURATION
	var dt: float = boss.get_physics_process_delta_time()
	while t > 0.0 and boss._alive:
		boss.global_position = (boss.global_position + dir * LUNGE_SPEED * dt).clamp(MapBounds.min_pos, MapBounds.max_pos)
		await boss.get_tree().physics_frame
		t -= dt
