class_name TelegraphCircle
extends Node2D
## Pooled boss telegraph (08 §16): a danger-color circle that grows over its lead
## time, then releases. Pure visual — the damage comes from the attack's payload.

@onready var visual: Blob = $Visual

var _t: float = 0.0
var _life: float = 1.0
var _radius: float = 64.0

func show_telegraph(radius: float, lead: float) -> void:
	_radius = radius
	_life = maxf(0.05, lead)
	_t = _life
	set_process(true)

func _process(delta: float) -> void:
	_t -= delta
	var k := 1.0 - clampf(_t / _life, 0.0, 1.0)        # 0 -> 1 as it fills
	if visual:
		visual.configure(Color(1.0, 0.2, 0.1, 0.3 + 0.3 * k), _radius * (0.35 + 0.65 * k))
	if _t <= 0.0:
		ObjectPool.release(self)

func _on_acquired() -> void:
	show()
	set_process(true)

func _on_released() -> void:
	hide()
	set_process(false)
