extends Node
## Persistent application root (07 §4). Owns screen transitions — frees the old
## screen, instances the new one under ScreenHolder, with a quick fade. Autoloads
## persist across all screens. Navigation is driven entirely by EventBus signals
## so screens never reference each other or this node.

const GAME := preload("res://scenes/main/game.tscn")
const MAIN_MENU := preload("res://scenes/ui/main_menu.tscn")
const CHARACTER_SELECT := preload("res://scenes/ui/character_select.tscn")
const RESULTS := preload("res://scenes/ui/results_screen.tscn")
const LOST_AND_FOUND := preload("res://scenes/ui/lost_and_found.tscn")

@onready var holder: Node = $ScreenHolder
@onready var fade: ColorRect = $Fade/ColorRect

var _current: Node = null
var _last_character_id: StringName = &"the_carny"
var _last_difficulty_id: StringName = &"midway"
var _swapping: bool = false

func _ready() -> void:
	EventBus.goto_menu.connect(_to_menu)
	EventBus.goto_character_select.connect(_to_character_select)
	EventBus.goto_lost_and_found.connect(_to_lost_and_found)
	EventBus.start_run.connect(_start_run)
	EventBus.run_again.connect(_run_again)
	EventBus.run_ended.connect(_on_run_ended)
	_apply_audio_settings()
	fade.color.a = 0.0
	_to_menu()

## Free the current screen and bring up `scene`; `configure` runs on the new
## instance BEFORE it enters the tree (so a run can get its character set first).
func _swap(scene: PackedScene, configure: Callable = Callable()) -> Node:
	if _swapping:
		return null
	_swapping = true
	await _fade_to(1.0)
	GameState.set_paused(false)           # never carry a pause across screens
	if is_instance_valid(_current):
		_current.queue_free()
		_current = null
	var inst := scene.instantiate()
	if configure.is_valid():
		configure.call(inst)
	holder.add_child(inst)
	_current = inst
	await _fade_to(0.0)
	_swapping = false
	return inst

func _fade_to(a: float) -> void:
	var t := create_tween()
	t.tween_property(fade, "color:a", a, 0.15)
	await t.finished

func _to_menu() -> void:
	await _swap(MAIN_MENU)

func _to_character_select() -> void:
	await _swap(CHARACTER_SELECT)

func _to_lost_and_found() -> void:
	await _swap(LOST_AND_FOUND)

func _start_run(character_id: StringName, difficulty_id: StringName) -> void:
	_last_character_id = character_id
	_last_difficulty_id = difficulty_id
	await _swap(GAME, func(g):
		g.character_id = character_id
		g.difficulty_id = difficulty_id)

func _run_again() -> void:
	await _swap(GAME, func(g):
		g.character_id = _last_character_id
		g.difficulty_id = _last_difficulty_id)

func _on_run_ended(_did_win: bool, stats: Dictionary) -> void:
	await _swap(RESULTS, func(r): r.setup(stats))

func _apply_audio_settings() -> void:
	var v: float = float(SaveManager.get_setting(&"master_volume", 1.0))
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.0001, v)))
