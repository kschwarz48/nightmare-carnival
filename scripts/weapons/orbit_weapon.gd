extends Weapon
## Crystal Orbs (06 §2, 08 §8 "orbit") — the King Bible (VS). On a cooldown it
## summons orbs that spin around the player for a duration, then cool down.
##   • Amount  → number of orbs (starts at 1), spaced evenly around the circle.
##   • Speed   → how fast they rotate (player projectile-speed stat).
##   • Duration→ how long they rotate before cooling down.
##   • Area    → ring radius (capped) + orb size.
## Cooldown is EXTENDED by the weapon's *base* duration (cd 3 + dur 3 = 6s total);
## that extension grows with level-ups (base-stat changes) but is NOT affected by
## the player's Duration bonus — Duration only lengthens the active spin.

const ORB := preload("res://scenes/weapons/orbit_orb.tscn")
const BASE_RADIUS := 92.0
const RADIUS_CAP := 220.0
const BASE_ORB := 13.0
const BASE_SPIN := 4.8           # rad/s at Speed ×1
const DUR_PER_LEVEL := 0.25      # base duration growth per level
const CAST_TIME := 0.4           # summon grow-in

var _orbs: Array = []
var _angle: float = 0.0
var _active_t: float = 0.0       # remaining active spin of the current cast
var _cast_elapsed: float = 0.0
var _recast_t: float = 0.5       # time until the next cast

func setup(p_data: WeaponData) -> void:
	super.setup(p_data)
	_recast_t = 0.5

func _process(delta: float) -> void:
	if GameState.is_paused or not GameState.is_running or GameState.player == null:
		return
	if _active_t > 0.0:
		_cast_elapsed += delta
		_active_t -= delta
		_orbit(delta)
		if _active_t <= 0.0:
			_despawn_orbs()
	_recast_t -= delta
	if _recast_t <= 0.0:
		_cast()
		_recast_t = _total_cycle()

func fire() -> void:
	pass          # cast loop handled in _process

# --- King Bible scaling ---
func _base_duration() -> float:
	return data.lifetime + DUR_PER_LEVEL * float(level - 1)

func _active_duration() -> float:
	return _base_duration() * _stats().duration_mult            # Duration extends spin

func _total_cycle() -> float:
	return current_cooldown() + _base_duration()                # cd extended by base duration

func _spin() -> float:
	return BASE_SPIN * _stats().projectile_speed_mult           # Speed drives rotation

func _radius() -> float:
	return minf(BASE_RADIUS * current_area(), RADIUS_CAP)        # Area widens the ring (capped)

func _orb_radius() -> float:
	return clampf(BASE_ORB * current_area(), BASE_ORB, BASE_ORB * 2.2)

func _cast() -> void:
	var want: int = maxi(1, current_amount())
	if _orbs.is_empty():
		for i in want:
			var orb := ORB.instantiate()
			_orb_parent().add_child(orb)
			orb.setup(_orb_radius())
			_orbs.append(orb)
		_cast_elapsed = 0.0
		_angle = 0.0
	else:
		_resize(want)                                           # already spinning: just refresh
	_active_t = _active_duration()

func _resize(want: int) -> void:
	while _orbs.size() < want:
		var orb := ORB.instantiate()
		_orb_parent().add_child(orb)
		orb.setup(_orb_radius())
		_orbs.append(orb)
	while _orbs.size() > want:
		var orb = _orbs.pop_back()
		if is_instance_valid(orb):
			orb.queue_free()

func _orbit(_delta: float) -> void:
	_angle += _spin() * _delta
	var n: int = _orbs.size()
	var radius: float = _radius()
	var orb_r: float = _orb_radius()
	var dmg: float = current_damage()
	var center: Vector2 = GameState.player.global_position
	var grow: float = clampf(_cast_elapsed / CAST_TIME, 0.0, 1.0)
	for i in n:
		var orb = _orbs[i]
		if not is_instance_valid(orb):
			continue
		var a: float = _angle + TAU * float(i) / float(maxi(1, n))
		orb.global_position = center + Vector2.from_angle(a) * radius * grow
		orb.scale = Vector2.ONE * grow
		orb.setup(orb_r)
		orb.set_damage(dmg)
		orb.set_hue(float(i) / float(maxi(1, n)))

func _despawn_orbs() -> void:
	for orb in _orbs:
		if is_instance_valid(orb):
			orb.queue_free()
	_orbs.clear()
	_active_t = 0.0

func _orb_parent() -> Node:
	return GameState.projectile_layer

func _exit_tree() -> void:
	_despawn_orbs()
