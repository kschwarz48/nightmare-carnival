extends Boss
## The Ferris Wheel (05 BOSS 2, gate 12:00). A roaming wheel: gondola fire in P1,
## tears free and ROLLS in P2, and throws everything in P3. Base Boss handles
## wake/roam/phases; the Roll attack drives its own movement.

func _build_phases() -> Array[BossPhase]:
	var p1 := BossPhase.new()
	p1.hp_threshold = 1.0
	p1.attacks = [
		preload("res://scripts/bosses/attacks/gondola_spiral.gd").new(),
		preload("res://scripts/bosses/attacks/gondola_drop.gd").new(),
	]
	var p2 := BossPhase.new()
	p2.hp_threshold = 0.6
	p2.attacks = [
		preload("res://scripts/bosses/attacks/ferris_roll.gd").new(),
		preload("res://scripts/bosses/attacks/gondola_spiral.gd").new(),
	]
	var p3 := BossPhase.new()
	p3.hp_threshold = 0.3
	p3.attacks = [
		preload("res://scripts/bosses/attacks/gondola_drop.gd").new(),
		preload("res://scripts/bosses/attacks/stampede_call.gd").new(),
		preload("res://scripts/bosses/attacks/ferris_roll.gd").new(),
	]
	var out: Array[BossPhase] = [p1, p2, p3]
	return out
