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
	await boss.get_tree().create_timer(lead, false).timeout

func execute(boss) -> void:
	# Suspend the Rotating Pole while pulling — being dragged into the maw AND a
	# sweeping wall at once is the "impossible" P2 overlap (player feedback).
	var pole = boss.get_node_or_null(^"RotatingPole")
	if pole:
		pole.set_paused(true)
	var t := DURATION
	while t > 0.0 and boss._alive:
		await boss.get_tree().physics_frame
		# physics_frame keeps firing while the tree is paused — don't advance the
		# pull or the timer during a pause (e.g. the level-up draft).
		if GameState.is_paused:
			continue
		var p = GameState.player
		if is_instance_valid(p):
			p.external_pull = (boss.global_position - p.global_position).normalized() * PULL_SPEED
		t -= boss.get_physics_process_delta_time()
	if is_instance_valid(GameState.player):
		(GameState.player as Player).external_pull = Vector2.ZERO
	if is_instance_valid(pole):
		pole.set_paused(false)
