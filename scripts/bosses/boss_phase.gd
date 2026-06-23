class_name BossPhase
extends RefCounted
## A boss phase (08 §17): an attack pool entered when HP drops past hp_threshold.

var hp_threshold: float = 1.0           # enter when ratio <= this
var attacks: Array[BossAttack] = []

func pick_attack(last: BossAttack) -> BossAttack:
	# Weighted; avoid an immediate repeat when there's a choice.
	var pool := attacks.duplicate()
	if last != null and pool.size() > 1:
		pool.erase(last)
	if pool.is_empty():
		return null
	var total := 0.0
	for a in pool:
		total += a.weight
	var r := randf() * total
	var acc := 0.0
	for a in pool:
		acc += a.weight
		if r <= acc:
			return a
	return pool.back()
