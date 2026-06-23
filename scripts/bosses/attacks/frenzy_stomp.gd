extends BossAttack
## Frenzy Stomp (05 P3): a rapid sequence of short-telegraph stomps that track
## the player's position — the angry, faster late-phase pressure.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const SHOCKWAVE := preload("res://scenes/bosses/shockwave.tscn")
const RADIUS := 120.0
const DMG := 25.0
const COUNT := 4
const STOMP_LEAD := 0.45

func _init() -> void:
	weight = 2.0
	cooldown = 0.5
	lead_time = 0.3

func execute(boss) -> void:
	for i in COUNT:
		if not boss._alive:
			return
		var pos: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
		var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
		tel.global_position = pos
		tel.call(&"show_telegraph", RADIUS, STOMP_LEAD)
		await boss.get_tree().create_timer(STOMP_LEAD).timeout
		if not boss._alive:
			return
		var sw := ObjectPool.acquire(SHOCKWAVE, boss.get_parent())
		sw.global_position = pos
		sw.call(&"detonate", DMG, RADIUS)
		await boss.get_tree().create_timer(0.22).timeout
