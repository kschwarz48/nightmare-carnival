extends BossAttack
## Inhale (05 P2): wind-up, then pull the player toward the maw for a few seconds
## (via player.external_pull). Pull < player speed, so actively fleeing resists it;
## maw contact hurts (boss hitbox). Move away / hide behind cover.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const PULL_SPEED := 170.0
const DURATION := 3.0

func _init() -> void:
	weight = 1.5
	cooldown = 1.0
	lead_time = 1.2

func telegraph(boss, lead: float) -> void:
	var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
	tel.global_position = boss.global_position
	tel.call(&"show_telegraph", 320.0, lead)
	await boss.get_tree().create_timer(lead).timeout

func execute(boss) -> void:
	var t := DURATION
	while t > 0.0 and boss._alive:
		var p = GameState.player
		if is_instance_valid(p):
			p.external_pull = (boss.global_position - p.global_position).normalized() * PULL_SPEED
		await boss.get_tree().physics_frame
		t -= boss.get_physics_process_delta_time()
	if is_instance_valid(GameState.player):
		(GameState.player as Player).external_pull = Vector2.ZERO
