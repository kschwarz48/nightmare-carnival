extends BossAttack
## Ringmaster — Cane Shockwave / Bullet Rings / Finale Barrage (05 all phases):
## rotating rings of projectiles with a readable safe gap. Weave the dark.

const POPCORN := preload("res://scenes/bosses/popcorn.tscn")
const WAVES := 5
const PER := 18
const GAP_DEG := 42.0
const DMG := 12.0

func _init() -> void:
	weight = 1.4
	cooldown = 1.2
	lead_time = 0.8

func execute(boss) -> void:
	var gap := randf() * TAU
	for w in WAVES:
		if not boss._alive:
			return
		for i in PER:
			var ang := TAU * float(i) / float(PER) + float(w) * 0.22   # rotate each ring
			if wrapf(ang - gap, 0.0, TAU) < deg_to_rad(GAP_DEG):
				continue                                   # the safe gap
			var pc := ObjectPool.acquire(POPCORN, boss.get_parent())
			pc.global_position = boss.global_position
			pc.call(&"launch", Vector2.from_angle(ang), DMG, 185.0, 5.0)
		await boss.get_tree().create_timer(0.4, false).timeout
