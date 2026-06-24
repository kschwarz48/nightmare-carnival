extends CanvasLayer
## In-run pause overlay + basic options (M4). Toggled with the `pause` action
## (Esc / controller Start); runs while the tree is paused (PROCESS_MODE_ALWAYS).
## Quit-to-menu abandons the run.

@onready var panel: Control = %Panel
@onready var options: Control = %Options
@onready var resume_btn: Button = %Resume
@onready var options_btn: Button = %OptionsBtn
@onready var quit_btn: Button = %Quit
@onready var volume: HSlider = %Volume
@onready var reduce_flash: CheckButton = %ReduceFlash
@onready var options_back: Button = %OptionsBack

var _open: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	panel.hide()
	options.hide()
	resume_btn.pressed.connect(_resume)
	options_btn.pressed.connect(_show_options)
	options_back.pressed.connect(_show_panel)
	quit_btn.pressed.connect(_quit)
	volume.value = float(SaveManager.get_setting(&"master_volume", 1.0))
	volume.value_changed.connect(_on_volume)
	reduce_flash.button_pressed = bool(SaveManager.get_setting(&"reduce_flashes", false))
	reduce_flash.toggled.connect(func(v): SaveManager.set_setting(&"reduce_flashes", v))

func _unhandled_input(e: InputEvent) -> void:
	if not e.is_action_pressed(&"pause"):
		return
	if _open:
		_resume()
		get_viewport().set_input_as_handled()
	elif GameState.is_running and not GameState.is_paused:
		_show()
		get_viewport().set_input_as_handled()

func _show() -> void:
	_open = true
	_show_panel()
	GameState.set_paused(true)

func _show_panel() -> void:
	options.hide()
	panel.show()
	resume_btn.grab_focus()

func _show_options() -> void:
	panel.hide()
	options.show()
	options_back.grab_focus()

func _resume() -> void:
	_open = false
	panel.hide()
	options.hide()
	GameState.set_paused(false)

func _quit() -> void:
	_open = false
	GameState.set_paused(false)
	GameState.is_running = false        # abandon the run (no payout)
	EventBus.goto_menu.emit()

func _on_volume(v: float) -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.0001, v)))
	SaveManager.set_setting(&"master_volume", v)
