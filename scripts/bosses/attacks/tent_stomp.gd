extends BossAttack
## Tent-Pole Stomp (05 P1): telegraph a circle where the player is, then slam an
## expanding shockwave there. Dodge by moving off the marked spot.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const SHOCKWAVE := preload("res://scenes/bosses/shockwave.tscn")
const RADIUS := 130.0
const DMG := 25.0

func _init() -> void:
	weight = 2.0
	cooldown = 0.6
	lead_time = 1.0

func telegraph(boss, lead: float) -> void:
	var pos: Vector2 = _player_pos(boss)
	boss.set_meta(&"_stomp_pos", pos)
	var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
	tel.global_position = pos
	tel.call(&"show_telegraph", RADIUS, lead)
	await boss.get_tree().create_timer(lead, false).timeout

func execute(boss) -> void:
	var pos: Vector2 = boss.get_meta(&"_stomp_pos", boss.global_position)
	var sw := ObjectPool.acquire(SHOCKWAVE, boss.get_parent())
	sw.global_position = pos
	sw.call(&"detonate", DMG, RADIUS)

func _player_pos(boss) -> Vector2:
	return GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
