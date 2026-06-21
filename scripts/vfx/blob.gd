class_name Blob
extends Node2D
## Programmer-art visual (M1). A self-drawing colored shape that stands in for
## final SpriteFrames. Supports FlashComponent via set_flash(). Replaced at M6.

enum Shape { CIRCLE, SQUARE, DIAMOND }

@export var color: Color = Color.WHITE
@export var radius: float = 12.0
@export var shape: Shape = Shape.CIRCLE
@export var outline: bool = false
@export var outline_color: Color = Color(0, 0, 0, 0.5)

var _flash: float = 0.0

func set_flash(value: float) -> void:
	_flash = value
	queue_redraw()

func configure(p_color: Color, p_radius: float, p_shape: Shape = Shape.CIRCLE) -> void:
	color = p_color
	radius = p_radius
	shape = p_shape
	queue_redraw()

func _draw() -> void:
	var c := color.lerp(Color.WHITE, _flash)
	match shape:
		Shape.SQUARE:
			var s := radius
			draw_rect(Rect2(-s, -s, s * 2.0, s * 2.0), c)
			if outline:
				draw_rect(Rect2(-s, -s, s * 2.0, s * 2.0), outline_color, false, 2.0)
		Shape.DIAMOND:
			var pts := PackedVector2Array([
				Vector2(0, -radius), Vector2(radius, 0),
				Vector2(0, radius), Vector2(-radius, 0),
			])
			draw_colored_polygon(pts, c)
		_:
			draw_circle(Vector2.ZERO, radius, c)
			if outline:
				draw_arc(Vector2.ZERO, radius, 0.0, TAU, 24, outline_color, 2.0)
