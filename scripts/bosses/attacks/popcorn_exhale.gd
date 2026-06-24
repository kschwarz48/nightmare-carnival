extends BossAttack
## Popcorn Exhale (05 P2): after the inhale, spit a wide cone of popcorn shots
## toward the player. Weave the gaps.

const TELEGRAPH := preload("res://scenes/vfx/telegraph_circle.tscn")
const POPCORN := preload("res://scenes/bosses/popcorn.tscn")
const COUNT := 9
const SPREAD_DEG := 70.0
const DMG := 16.0

func _init() -> void:
	weight = 1.2
	cooldown = 0.8
	lead_time = 0.8

func telegraph(boss, lead: float) -> void:
	var tel := ObjectPool.acquire(TELEGRAPH, boss.get_parent())
	tel.global_position = boss.global_position
	tel.call(&"show_telegraph", 120.0, lead)
	await boss.get_tree().create_timer(lead, false).timeout

func execute(boss) -> void:
	var base := Vector2.RIGHT
	if is_instance_valid(GameState.player):
		base = boss.global_position.direction_to(GameState.player.global_position)
	var half := deg_to_rad(SPREAD_DEG) * 0.5
	for i in COUNT:
		var off := lerpf(-half, half, float(i) / float(COUNT - 1))
		var pc := ObjectPool.acquire(POPCORN, boss.get_parent())
		pc.global_position = boss.global_position
		pc.call(&"launch", base.rotated(off), DMG, 280.0, 3.0)
