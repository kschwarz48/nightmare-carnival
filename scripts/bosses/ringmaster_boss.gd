extends Boss
## The Ringmaster (05 BOSS 4, gate 24:00, FINAL). Roaming finale: the human
## conductor (P1), the parade of prior bosses (P2), then the demon bullet-hell
## (P3). Defeating him ends the night (Dawn). Phase gates 66% / 33%.

func _build_phases() -> Array[BossPhase]:
	var p1 := BossPhase.new()
	p1.hp_threshold = 1.0
	p1.attacks = [
		preload("res://scripts/bosses/attacks/whip_crack.gd").new(),
		preload("res://scripts/bosses/attacks/bullet_rings.gd").new(),
		preload("res://scripts/bosses/attacks/summon_mixed.gd").new(),
	]
	var p2 := BossPhase.new()
	p2.hp_threshold = 0.66
	p2.attacks = [
		preload("res://scripts/bosses/attacks/parade_of_horrors.gd").new(),
		preload("res://scripts/bosses/attacks/bullet_rings.gd").new(),
	]
	var p3 := BossPhase.new()
	p3.hp_threshold = 0.33
	p3.attacks = [
		preload("res://scripts/bosses/attacks/bullet_rings.gd").new(),
		preload("res://scripts/bosses/attacks/summon_mixed.gd").new(),
		preload("res://scripts/bosses/attacks/whip_crack.gd").new(),
	]
	var out: Array[BossPhase] = [p1, p2, p3]
	return out
