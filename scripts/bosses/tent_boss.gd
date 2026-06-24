extends Boss
## The Carnival Tent (05 BOSS 1). Sits dormant at map center, wakes at the gate,
## then slowly stalks the player. Three phases of attacks (base Boss handles
## dormancy, roaming, and phase transitions). Full bible moveset.

const ROTATING_POLE := preload("res://scenes/bosses/rotating_pole.tscn")

var _pole: Node2D = null

func _build_phases() -> Array[BossPhase]:
	var p1 := BossPhase.new()
	p1.hp_threshold = 1.0
	p1.attacks = [
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/concession_spew.gd").new(),
		preload("res://scripts/bosses/attacks/pennant_flap.gd").new(),
	]
	# Phase 2 is the suck-in phase: NO stomp here — you can't dodge a pole slam
	# while being pulled toward the maw. Inhale + Popcorn Exhale + Stake Drop, with
	# the always-on Rotating Pole sweeping (added in _on_phase_entered).
	var p2 := BossPhase.new()
	p2.hp_threshold = 0.6
	p2.attacks = [
		preload("res://scripts/bosses/attacks/inhale.gd").new(),
		preload("res://scripts/bosses/attacks/popcorn_exhale.gd").new(),
		preload("res://scripts/bosses/attacks/stake_drop.gd").new(),
	]
	var p3 := BossPhase.new()
	p3.hp_threshold = 0.3
	p3.attacks = [
		preload("res://scripts/bosses/attacks/frenzy_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/clown_call.gd").new(),
		preload("res://scripts/bosses/attacks/ring_of_fire.gd").new(),
	]
	var out: Array[BossPhase] = [p1, p2, p3]
	return out

## Rotating Pole is an always-on hazard for Phase 2 only.
func _on_phase_entered(index: int) -> void:
	if index == 1 and _pole == null:
		_pole = ROTATING_POLE.instantiate()
		add_child(_pole)
	elif index >= 2 and is_instance_valid(_pole):
		_pole.queue_free()
		_pole = null
