class_name FlashComponent
extends Node
## White-flash + squash on hit (08 §4, 02 §6). Connect health.damaged -> flash.
## Works with a ShaderMaterial "flash" uniform OR a programmer-art visual that
## exposes set_flash(float) (see Blob).

## Path to the visual to flash (resolved in _ready). Defaults to a sibling
## "Visual" — the convention for actors in this project. NOTE: this MUST be a
## NodePath export, not a typed-node export: a `NodePath(...)` value assigned to
## a `CanvasItem`-typed @export silently fails to resolve (the M2 flash bug).
@export var sprite_path: NodePath = ^"../Visual"
@export var flash_time: float = 0.10
@export var squash: float = 0.82
## Flash tint. With strobe on, the flash alternates flash_color <-> flash_color_alt
## (e.g. red/white on the player) so damage reads loudly; default is a plain white hit.
@export var flash_color: Color = Color.WHITE
@export var flash_color_alt: Color = Color.WHITE
@export var strobe: bool = false
@export var strobe_hz: float = 14.0

var sprite: CanvasItem
var _t: float = 0.0
var _base_scale: Vector2 = Vector2.ONE
var _strobe_active: bool = false        # strobe, unless the "reduce flashes" option is on

func _ready() -> void:
	sprite = get_node_or_null(sprite_path) as CanvasItem
	if sprite:
		_base_scale = sprite.scale
	set_process(false)

func flash(_info: DamageInfo = null) -> void:
	_t = flash_time
	_strobe_active = strobe and not bool(SaveManager.get_setting(&"reduce_flashes", false))
	_set_flash(1.0, _current_tint())
	if sprite:
		sprite.scale = _base_scale * Vector2(1.0 / squash, squash)
	set_process(true)

## Tint for the current instant — alternates the two colors when strobing.
func _current_tint() -> Color:
	if not _strobe_active:
		return flash_color
	var elapsed := flash_time - _t
	return flash_color if fmod(elapsed * strobe_hz, 1.0) < 0.5 else flash_color_alt

func _set_flash(value: float, tint: Color = Color.WHITE) -> void:
	if sprite == null:
		return
	if sprite.material is ShaderMaterial:
		(sprite.material as ShaderMaterial).set_shader_parameter("flash", value)
		(sprite.material as ShaderMaterial).set_shader_parameter("flash_color", tint)
	elif sprite.has_method(&"set_flash"):
		sprite.call(&"set_flash", value, tint)

func _process(delta: float) -> void:
	_t -= delta
	if _strobe_active:
		_set_flash(1.0, _current_tint())
	if sprite:
		sprite.scale = sprite.scale.lerp(_base_scale, 1.0 - exp(-18.0 * delta))
	if _t <= 0.0:
		_set_flash(0.0, flash_color)
		if sprite:
			sprite.scale = _base_scale
		set_process(false)
