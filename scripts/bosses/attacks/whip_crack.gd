extends BossAttack
## Ringmaster — Whip Crack (05 P1): 2–3 fast fanned volleys lashed at the player.

const POPCORN := preload("res://scenes/bosses/popcorn.tscn")
const CRACKS := 3
const PER := 5
const DMG := 24.0

func _init() -> void:
	weight = 1.5
	cooldown = 0.9
	lead_time = 0.7

func execute(boss) -> void:
	for c in CRACKS:
		if not boss._alive:
			return
		var base := Vector2.RIGHT
		if is_instance_valid(GameState.player):
			base = boss.global_position.direction_to(GameState.player.global_position)
		for i in PER:
			var off := deg_to_rad(lerpf(-16.0, 16.0, float(i) / float(PER - 1)))
			var pc := ObjectPool.acquire(POPCORN, boss.get_parent())
			pc.global_position = boss.global_position
			pc.call(&"launch", base.rotated(off), DMG, 430.0, 3.0)
		await boss.get_tree().create_timer(0.35, false).timeout
