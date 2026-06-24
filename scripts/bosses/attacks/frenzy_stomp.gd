extends BossAttack
## Frenzy Stomp (05 P3): a sequence of stomps that track the player's position —
## the angry, faster late-phase pressure. Each stomp telegraphs long enough to
## actually clear it (lead 0.8s > RADIUS/player_speed ≈ 0.5s) and the stomps are
## spaced into a readable rhythm rather than an undodgeable blur.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const SHOCKWAVE := preload("res://scenes/bosses/shockwave.tscn")
const RADIUS := 110.0
const DMG := 25.0
const COUNT := 3
const STOMP_LEAD := 0.8
const STOMP_GAP := 0.4

func _init() -> void:
	weight = 1.5
	cooldown = 1.0
	lead_time = 0.3

func execute(boss) -> void:
	for i in COUNT:
		if not boss._alive:
			return
		var pos: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
		var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
		tel.global_position = pos
		tel.call(&"show_telegraph", RADIUS, STOMP_LEAD)
		await boss.get_tree().create_timer(STOMP_LEAD, false).timeout
		if not boss._alive:
			return
		var sw := ObjectPool.acquire(SHOCKWAVE, boss.get_parent())
		sw.global_position = pos
		sw.call(&"detonate", DMG, RADIUS)
		await boss.get_tree().create_timer(STOMP_GAP, false).timeout
