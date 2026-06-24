extends Weapon
## Crystal Orbs (06 §2, 08 §8 "orbit"). N orbs rotate around the player, dealing
## continuous contact damage to anything they sweep through — an always-on,
## no-aim defensive shape of fire. Scales with Amount (orb count), Area (orb size
## + ring radius), Might (damage), Duration (spin speed). Orbs are persistent
## child nodes, not pooled projectiles, so this overrides the cooldown-fire loop.

const ORB := preload("res://scenes/weapons/orbit_orb.tscn")
const BASE_RADIUS := 92.0
const BASE_SPIN := 2.0          # rad/s

var _orbs: Array = []
var _angle: float = 0.0

func setup(p_data: WeaponData) -> void:
	super.setup(p_data)
	_sync_orbs()

func _process(delta: float) -> void:
	if GameState.is_paused or not GameState.is_running or GameState.player == null:
		return
	_sync_orbs()
	_angle += BASE_SPIN * _stats().duration_mult * delta
	var n: int = _orbs.size()
	var radius: float = BASE_RADIUS * current_area()
	var dmg: float = current_damage()
	var center: Vector2 = GameState.player.global_position
	for i in n:
		var orb = _orbs[i]
		if not is_instance_valid(orb):
			continue
		var a: float = _angle + TAU * float(i) / float(maxi(1, n))
		orb.global_position = center + Vector2.from_angle(a) * radius
		orb.set_damage(dmg)

func fire() -> void:
	pass          # orbs are persistent; nothing is fired on cooldown

func _sync_orbs() -> void:
	var want: int = maxi(1, current_amount())
	var area: float = current_area()
	while _orbs.size() < want:
		var orb := ORB.instantiate()
		_orb_parent().add_child(orb)
		orb.setup(area)
		_orbs.append(orb)
	while _orbs.size() > want:
		var orb = _orbs.pop_back()
		if is_instance_valid(orb):
			orb.queue_free()
	# Keep sizes in sync with Area as it levels up.
	for orb in _orbs:
		if is_instance_valid(orb):
			orb.setup(area)

func _orb_parent() -> Node:
	return get_tree().current_scene.get_node(^"%ProjectileLayer")

func _exit_tree() -> void:
	for orb in _orbs:
		if is_instance_valid(orb):
			orb.queue_free()
	_orbs.clear()
