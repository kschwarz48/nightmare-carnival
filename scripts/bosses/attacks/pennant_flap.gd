extends BossAttack
## Pennant Flap (05 P1): a flat row of pennant-flag shots sweeps across toward the
## player at a fixed line — with a gap to sidestep through. Reuses the popcorn
## projectile as the flag.

const POPCORN := preload("res://scenes/bosses/popcorn.tscn")
const COUNT := 11
const DMG := 14.0
const SPEED := 330.0
const SPACING := 72.0

func _init() -> void:
	weight = 1.0
	cooldown = 1.0
	lead_time = 0.9        # canvas pulls taut (telegraph) before the row launches

func execute(boss) -> void:
	var sweep := Vector2.RIGHT
	if is_instance_valid(GameState.player):
		sweep = boss.global_position.direction_to(GameState.player.global_position)
	var perp := sweep.orthogonal()
	var origin: Vector2 = boss.global_position - sweep * 90.0
	var gap := randi_range(2, COUNT - 3)        # the dodge window
	for i in COUNT:
		if i == gap or i == gap + 1:
			continue
		var off := (float(i) - float(COUNT - 1) * 0.5) * SPACING
		var pc := ObjectPool.acquire(POPCORN, boss.get_parent())
		pc.global_position = origin + perp * off
		pc.call(&"launch", sweep, DMG, SPEED, 4.0)
