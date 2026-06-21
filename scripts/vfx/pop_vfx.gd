class_name PopVfx
extends Node2D
## Pooled one-shot "pop" burst on enemy death (08 §16). Programmer-art ring +
## confetti specks that expand and fade, then return to the pool.

@export var color: Color = Color(1.0, 0.95, 0.8)
@export var duration: float = 0.32
@export var max_radius: float = 30.0

var _t: float = 0.0
var _specks: Array[Vector2] = []

func _ready() -> void:
	set_process(false)

func _build_specks() -> void:
	_specks.clear()
	for _i in 6:
		_specks.append(Vector2.from_angle(randf() * TAU) * randf_range(0.6, 1.0))

func _process(delta: float) -> void:
	_t -= delta
	queue_redraw()
	if _t <= 0.0:
		ObjectPool.release(self)

func _draw() -> void:
	var k := 1.0 - clampf(_t / duration, 0.0, 1.0)   # 0 -> 1 over lifetime
	var alpha := 1.0 - k
	var ring := color
	ring.a = alpha
	draw_arc(Vector2.ZERO, max_radius * k, 0.0, TAU, 20, ring, 3.0)
	for d in _specks:
		var p := d * max_radius * k * 1.2
		draw_circle(p, 3.0 * (1.0 - k), ring)

func _on_acquired() -> void:
	_t = duration
	_build_specks()
	show()
	set_process(true)
	queue_redraw()

func _on_released() -> void:
	hide()
	set_process(false)
