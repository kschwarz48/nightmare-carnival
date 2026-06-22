extends CanvasLayer
## The level-up draft (08 §9, 06 §4). On level-up: pause, generate options,
## present cards; on pick: apply, then either show the next queued draft or unpause.

const CARD_COUNT := 3

@onready var panel: Control = %Panel
@onready var cards_box: VBoxContainer = %Cards

var _card_buttons: Array[Button] = []
var _current: Array[UpgradeData] = []
var _pending_levels: int = 0
var _open: bool = false
var _pick_frame: int = -1            # guards against a double-pick in one frame

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS   # work while the tree is paused
	panel.hide()
	for child in cards_box.get_children():
		if child is Button:
			_card_buttons.append(child)
	for i in _card_buttons.size():
		_card_buttons[i].pressed.connect(_on_card_pressed.bind(i))
	EventBus.player_leveled_up.connect(_on_leveled_up)

## Controller/keyboard select. The tree is paused during the draft and gamepad
## `ui_accept` can fail to activate the focused Button, so we also accept the
## project's `confirm` action (joypad Cross/A + Space + Enter). _unhandled_input
## only fires when the focused Button DIDN'T already consume the press, so there
## is no double-selection.
func _unhandled_input(event: InputEvent) -> void:
	if not _open:
		return
	if event.is_action_pressed(&"confirm"):
		_on_card_pressed(_focused_index())
		get_viewport().set_input_as_handled()

func _focused_index() -> int:
	var idx := _card_buttons.find(get_viewport().gui_get_focus_owner())
	if idx < 0 or idx >= _current.size():
		return 0 if not _current.is_empty() else -1
	return idx

func _on_leveled_up(_new_level: int) -> void:
	_pending_levels += 1
	if not _open:
		_open_next()

func _open_next() -> void:
	if _pending_levels <= 0:
		_close()
		return
	_pending_levels -= 1
	_current = DraftGenerator.generate(CARD_COUNT)
	if _current.is_empty():
		# Nothing legal to offer (e.g., everything maxed) — skip gracefully.
		_open_next()
		return
	_populate()
	_open = true
	panel.show()
	GameState.set_paused(true)
	if not _card_buttons.is_empty():
		_card_buttons[0].grab_focus()

func _populate() -> void:
	for i in _card_buttons.size():
		var btn := _card_buttons[i]
		if i < _current.size():
			var up := _current[i]
			btn.text = "%s\n%s" % [up.display_name, up.description]
			btn.show()
			btn.disabled = false
		else:
			btn.hide()

func _on_card_pressed(index: int) -> void:
	# Idempotent per frame: ui_accept (Button) and `confirm` can both land on the
	# same press; only the first takes effect.
	if index < 0 or index >= _current.size() or Engine.get_process_frames() == _pick_frame:
		return
	_pick_frame = Engine.get_process_frames()
	var up := _current[index]
	up.apply(GameState.player as Player)
	_open_next()

func _close() -> void:
	_open = false
	panel.hide()
	GameState.set_paused(false)
