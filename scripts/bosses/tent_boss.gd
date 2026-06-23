extends Boss
## The Carnival Tent (05 BOSS 1). Sits dormant at map center, wakes at the gate,
## then slowly stalks the player. Three phases of curated attacks (base Boss
## handles dormancy, roaming, and phase transitions).

func _build_phases() -> Array[BossPhase]:
	var p1 := BossPhase.new()
	p1.hp_threshold = 1.0
	p1.attacks = [
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/concession_spew.gd").new(),
	]
	# Phase 2 is the suck-in phase: NO stomp here — you can't dodge a pole slam
	# while being pulled toward the maw. Just Inhale + Popcorn Exhale.
	var p2 := BossPhase.new()
	p2.hp_threshold = 0.6
	p2.attacks = [
		preload("res://scripts/bosses/attacks/inhale.gd").new(),
		preload("res://scripts/bosses/attacks/popcorn_exhale.gd").new(),
	]
	var p3 := BossPhase.new()
	p3.hp_threshold = 0.3
	p3.attacks = [
		preload("res://scripts/bosses/attacks/frenzy_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/clown_call.gd").new(),
	]
	var out: Array[BossPhase] = [p1, p2, p3]
	return out
