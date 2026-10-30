extends BossAttack
## Ferris Wheel — Gondola Spiral (05 P1): gondolas fire on rotation, producing a
## slow rotating spiral of projectiles. Walk the gaps. Reuses the Popcorn shot.

const POPCORN := preload("res://scenes/bosses/popcorn.tscn")
const WAVES := 9
const PER_WAVE := 5
const DMG := 12.0

func _init() -> void:
	weight = 1.5
	cooldown = 1.0
	lead_time = 0.8

func execute(boss) -> void:
	var base := randf() * TAU
	for w in WAVES:
		if not boss._alive:
			return
		for i in PER_WAVE:
			var ang := base + TAU * float(i) / float(PER_WAVE)
			var pc := ObjectPool.acquire(POPCORN, boss.get_parent())
			pc.global_position = boss.global_position
			pc.call(&"launch", Vector2.from_angle(ang), DMG, 210.0, 4.5)
		base += 0.42                       # rotate each wave → spiral arms
		await boss.get_tree().create_timer(0.18, false).timeout
