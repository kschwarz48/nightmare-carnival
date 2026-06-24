extends Weapon
## Summon style (06 §2, 08 §8) — e.g. Plush Companion / Ringleader minions. Keeps
## `Amount` autonomous pets orbiting the player; each bites the nearest enemy in
## range on its own cooldown. Proves the WEAPON_SCRIPTS registry extends to a
## persistent-minion shape (not just fire-on-cooldown). Programmer-art Blob pets.

const ORBIT_R := 74.0
const SPIN := 1.8
const BITE_RANGE := 230.0

var _minions: Array[Blob] = []
var _bite: Array[float] = []         # per-minion cooldown remaining
var _angle: float = 0.0

func _process(delta: float) -> void:
	if GameState.is_paused or not GameState.is_running or GameState.player == null:
		return
	_sync()
	_angle += SPIN * delta
	var n := _minions.size()
	var center: Vector2 = GameState.player.global_position
	for i in n:
		var m := _minions[i]
		if not is_instance_valid(m):
			continue
		m.global_position = center + Vector2.from_angle(_angle + TAU * float(i) / float(maxi(1, n))) * ORBIT_R
		_bite[i] -= delta
		if _bite[i] <= 0.0 and _bite_nearest(m):
			_bite[i] = current_cooldown()      # cooldown stat = bite rate

func fire() -> void:
	pass          # minions are persistent; nothing is fired on cooldown

func _bite_nearest(m: Blob) -> bool:
	var foe := EnemyDirector.get_nearest_enemy(m.global_position, BITE_RANGE)
	if foe == null:
		return false
	var hb = foe.get(&"hurtbox")          # Enemy/Boss both expose a HurtboxComponent
	if hb == null:
		return false
	var crit := _stats().roll_crit()
	var dmg := current_damage() * (_stats().crit_damage if crit else 1.0)
	hb.receive(DamageInfo.new(dmg, self, crit, current_knockback()))
	m.scale = Vector2.ONE * 1.4          # lunge pop (eases back in _process via _sync sizing)
	return true

func _sync() -> void:
	var want: int = maxi(1, current_amount())
	while _minions.size() < want:
		var m := Blob.new()
		m.configure(Color(1.0, 0.5, 0.75), 9.0, Blob.Shape.SQUARE)
		m.outline = true
		_orb_parent().add_child(m)
		_minions.append(m)
		_bite.append(0.0)
	while _minions.size() > want:
		var m: Blob = _minions.pop_back()
		_bite.pop_back()
		if is_instance_valid(m):
			m.queue_free()
	for m in _minions:
		if is_instance_valid(m):
			m.scale = m.scale.lerp(Vector2.ONE, 0.2)

func _orb_parent() -> Node:
	return GameState.projectile_layer

func _exit_tree() -> void:
	for m in _minions:
		if is_instance_valid(m):
			m.queue_free()
	_minions.clear()
	_bite.clear()
