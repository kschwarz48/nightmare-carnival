class_name FlashComponent
extends Node
## White-flash + squash on hit (08 §4). Connect health.damaged -> flash.
## Works with a ShaderMaterial "flash" uniform OR a programmer-art visual that
## exposes set_flash(float) (see Blob). Falls back gracefully to neither.

@export var sprite: CanvasItem
@export var flash_time: float = 0.08
@export var squash: float = 0.85

var _t: float = 0.0
var _base_scale: Vector2 = Vector2.ONE

func _ready() -> void:
	if sprite:
		_base_scale = sprite.scale
	set_process(false)

func flash(_info: DamageInfo = null) -> void:
	_t = flash_time
	_set_flash(1.0)
	if sprite:
		sprite.scale = _base_scale * Vector2(1.0 / squash, squash)
	set_process(true)

func _set_flash(value: float) -> void:
	if sprite == null:
		return
	if sprite.material is ShaderMaterial:
		(sprite.material as ShaderMaterial).set_shader_parameter("flash", value)
	elif sprite.has_method(&"set_flash"):
		sprite.call(&"set_flash", value)

func _process(delta: float) -> void:
	_t -= delta
	if sprite:
		sprite.scale = sprite.scale.lerp(_base_scale, 1.0 - exp(-18.0 * delta))
	if _t <= 0.0:
		_set_flash(0.0)
		if sprite:
			sprite.scale = _base_scale
		set_process(false)
