extends BossAttack
## Ringmaster — Parade of Horrors (05 P2): the finale's signature. He conducts the
## prior bosses' signature attacks in sequence — a mini Roll (Wheel), a String
## Sweep (Puppet King), a Stomp (Tent) — by running their actual BossAttacks.

const ACTS := [
	preload("res://scripts/bosses/attacks/ferris_roll.gd"),
	preload("res://scripts/bosses/attacks/pennant_flap.gd"),
	preload("res://scripts/bosses/attacks/tent_stomp.gd"),
]

func _init() -> void:
	weight = 1.2
	cooldown = 1.5
	lead_time = 0.5

func execute(boss) -> void:
	for s: GDScript in ACTS:
		if not boss._alive:
			return
		var atk: BossAttack = s.new()
		await atk.telegraph(boss, atk.lead_time)
		if not boss._alive:
			return
		await atk.execute(boss)
		await boss.get_tree().create_timer(0.3, false).timeout
