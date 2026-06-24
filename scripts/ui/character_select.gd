extends Control
## Character select (07 §4). Lists ContentDB characters; locked ones (unlock_id
## not yet in SaveManager.unlocks) are disabled. Pick → start a run (Midway).

@onready var list: VBoxContainer = %List
@onready var back_btn: Button = %Back

func _ready() -> void:
	for c: CharacterData in ContentDB.all_characters():
		var unlocked: bool = c.unlock_id == &"" or SaveManager.is_unlocked(c.unlock_id)
		var b := Button.new()
		b.custom_minimum_size = Vector2(460, 56)
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		if unlocked:
			b.text = "%s — %s" % [c.display_name, c.description]
			b.pressed.connect(_pick.bind(c.id))
		else:
			b.text = "%s  (LOCKED)" % c.display_name
			b.disabled = true
		list.add_child(b)
	back_btn.pressed.connect(func(): EventBus.goto_menu.emit())
	for child in list.get_children():
		if child is Button and not (child as Button).disabled:
			(child as Button).grab_focus()
			break

func _pick(id: StringName) -> void:
	EventBus.start_run.emit(id)
