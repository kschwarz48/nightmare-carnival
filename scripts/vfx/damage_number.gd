class_name DamageNumber
extends Node2D
## Pooled floating number (08 §16). Concurrency-capped to protect frame-time
## at bullet-heaven scale.

const SCENE := preload("res://scenes/vfx/damage_number.tscn")
const MAX_CONCURRENT := 60

static var _active_count: int = 0

@onready var label: Label = $Label

var _t: float = 0.0
var _vel: Vector2

## Acquire + show a number; silently skips when over the concurrency cap.
static func spawn(parent: Node, pos: Vector2, amount: float, is_crit: bool) -> void:
	if _active_count >= MAX_CONCURRENT:
		return
	var dn := ObjectPool.acquire(SCENE, parent) as DamageNumber
	dn.global_position = pos
	dn.show_number(amount, is_crit)

func show_number(amount: float, is_crit: bool) -> void:
	label.text = str(int(round(amount)))
	label.modulate = Color(1, 0.85, 0.2) if is_crit else Color(1, 1, 1)
	scale = Vector2.ONE * (1.4 if is_crit else 1.0)
	_vel = Vector2(randf_range(-20, 20), -60)
	_t = 0.6
	set_process(true)

func _process(delta: float) -> void:
	_t -= delta
	position += _vel * delta
	_vel.y += 90.0 * delta
	modulate.a = clampf(_t / 0.6, 0.0, 1.0)
	if _t <= 0.0:
		ObjectPool.release(self)

func _on_acquired() -> void:
	_active_count += 1
	show()
	modulate.a = 1.0

func _on_released() -> void:
	_active_count = maxi(0, _active_count - 1)
	hide()
	set_process(false)
