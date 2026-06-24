extends BossAttack
## Ring of Fire (05 P3): a ring of flame spawns around the player and closes
## inward, forcing them to move — with one escape gap to run through. Reuses the
## popcorn projectile as slow-moving fire converging on the spawn center.

const POPCORN := preload("res://scenes/bosses/popcorn.tscn")
const SEGMENTS := 24
const DMG := 18.0
const START_RADIUS := 520.0
const SPEED := 95.0
const LIFE := 5.0
const GAP_DEG := 48.0

func _init() -> void:
	weight = 1.0
	cooldown = 1.4
	lead_time = 1.0

func execute(boss) -> void:
	var center: Vector2 = GameState.player.global_position if is_instance_valid(GameState.player) else boss.global_position
	var gap_start := randf() * TAU
	var gap_span := deg_to_rad(GAP_DEG)
	for i in SEGMENTS:
		var ang := (TAU / float(SEGMENTS)) * float(i)
		if wrapf(ang - gap_start, 0.0, TAU) < gap_span:
			continue                                  # leave one gap to escape through
		var pos := center + Vector2.from_angle(ang) * START_RADIUS
		var pc := ObjectPool.acquire(POPCORN, boss.get_parent())
		pc.global_position = pos
		pc.call(&"launch", (center - pos).normalized(), DMG, SPEED, LIFE)
