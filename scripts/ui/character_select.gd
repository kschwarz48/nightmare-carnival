extends Control
## Character + difficulty select (07 §4). Lists ContentDB characters (locked ones
## disabled) and a difficulty row; picking a character starts the run on the
## currently-selected difficulty.

@onready var list: VBoxContainer = %List
@onready var diff_row: HBoxContainer = %DiffRow
@onready var back_btn: Button = %Back

var _difficulty: StringName = &"midway"
var _diff_btns: Array[Button] = []

func _ready() -> void:
	# Difficulty radio row (ordered easiest-first by hp_mult).
	var diffs := ContentDB.all_difficulties().duplicate()
	diffs.sort_custom(func(a, b): return a.hp_mult < b.hp_mult)
	for d: DifficultyData in diffs:
		var b := Button.new()
		b.toggle_mode = true
		b.custom_minimum_size = Vector2(140, 40)
		b.text = d.display_name
		b.pressed.connect(_pick_difficulty.bind(d.id))
		diff_row.add_child(b)
		_diff_btns.append(b)
	if not diffs.is_empty():
		_pick_difficulty(diffs[0].id)

	for c: CharacterData in ContentDB.all_characters():
		var unlocked: bool = c.unlock_id == &"" or SaveManager.is_unlocked(c.unlock_id)
		var b := Button.new()
		b.custom_minimum_size = Vector2(460, 56)
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		if unlocked:
			b.text = "%s — %s" % [c.display_name, c.description]
			b.pressed.connect(_pick_character.bind(c.id))
		else:
			b.text = "%s  (LOCKED)" % c.display_name
			b.disabled = true
		list.add_child(b)
	back_btn.pressed.connect(func(): EventBus.goto_menu.emit())
	for child in list.get_children():
		if child is Button and not (child as Button).disabled:
			(child as Button).grab_focus()
			break

func _pick_difficulty(id: StringName) -> void:
	_difficulty = id
	for b in _diff_btns:
		b.button_pressed = b.text == ContentDB.get_difficulty(id).display_name

func _pick_character(id: StringName) -> void:
	EventBus.start_run.emit(id, _difficulty)
