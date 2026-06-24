extends Weapon
## Crystal Orbs (06 §2, 08 §8 "orbit") — modelled on the Holy Bible (VS): on a
## cooldown it SUMMONS a set of orbs that spin fast around the player for a
## DURATION, then vanish until the next cast. Leveling adds orbs and raises both
## the orbit SPEED and the DURATION, so at max level the orbs are up almost
## permanently — a wall of spinning death. Orbs are weapon-owned (not pooled).

const ORB := preload("res://scenes/weapons/orbit_orb.tscn")
const BASE_RADIUS := 92.0
const BASE_SPIN := 4.5          # rad/s at level 1
const CAST_TIME := 0.4          # summon grow-in

var _orbs: Array = []
var _angle: float = 0.0
var _active_t: float = 0.0       # remaining duration of the current cast
var _cast_elapsed: float = 0.0

func _process(delta: float) -> void:
	if GameState.is_paused or not GameState.is_running or GameState.player == null:
		return
	if _active_t > 0.0:
		_cast_elapsed += delta
		_active_t -= delta
		_orbit(delta)
		if _active_t <= 0.0:
			_despawn_orbs()
	else:
		_cd -= delta
		if _cd <= 0.0:
			_cast()
			_cd = current_cooldown()

func fire() -> void:
	pass          # cast loop is handled in _process

# --- orbit-specific scaling ---
func _spin() -> float:
	return BASE_SPIN * (1.0 + 0.12 * float(level - 1)) * _stats().duration_mult

func _duration() -> float:
	return data.lifetime * _stats().duration_mult * (1.0 + 0.15 * float(level - 1))

func _cast() -> void:
	var want: int = maxi(1, current_amount())
	var area: float = current_area()
	for i in want:
		var orb := ORB.instantiate()
		_orb_parent().add_child(orb)
		orb.setup(area)
		_orbs.append(orb)
	_angle = 0.0
	_cast_elapsed = 0.0
	_active_t = _duration()

func _orbit(delta: float) -> void:
	_angle += _spin() * delta
	var n: int = _orbs.size()
	var radius: float = BASE_RADIUS * current_area()
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
		orb.set_damage(dmg)

func _despawn_orbs() -> void:
	for orb in _orbs:
		if is_instance_valid(orb):
			orb.queue_free()
	_orbs.clear()
	_active_t = 0.0

func _orb_parent() -> Node:
	return get_tree().current_scene.get_node(^"%ProjectileLayer")

func _exit_tree() -> void:
	_despawn_orbs()
