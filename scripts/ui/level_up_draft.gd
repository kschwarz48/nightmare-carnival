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

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS   # work while the tree is paused
	panel.hide()
	for child in cards_box.get_children():
		if child is Button:
			_card_buttons.append(child)
	for i in _card_buttons.size():
		_card_buttons[i].pressed.connect(_on_card_pressed.bind(i))
	EventBus.player_leveled_up.connect(_on_leveled_up)

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
	if index >= _current.size():
		return
	var up := _current[index]
	up.apply(GameState.player as Player)
	_open_next()

func _close() -> void:
	_open = false
	panel.hide()
	GameState.set_paused(false)
