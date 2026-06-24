extends Control
## Lost & Found meta hub (01 §9). Spend Lost Tickets on escalating, capped stat
## perks + one demo unlock (Crystal Orbs into the draft pool); Carnival-pedia stub.

const ORBS_UNLOCK := &"weapon_crystal_orbs"
const ORBS_COST := 150

@onready var tickets_label: Label = %Tickets
@onready var perks_box: VBoxContainer = %Perks
@onready var unlock_btn: Button = %UnlockOrbs
@onready var pedia_label: Label = %Pedia
@onready var back_btn: Button = %Back

var _rows: Dictionary = {}      # perk id -> { "label": Label, "button": Button }

func _ready() -> void:
	for id: StringName in SaveManager.PERKS:
		_add_perk_row(id)
	unlock_btn.pressed.connect(_buy_orbs)
	back_btn.pressed.connect(func(): EventBus.goto_menu.emit())
	back_btn.grab_focus()
	_refresh()

func _add_perk_row(id: StringName) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override(&"separation", 14)
	var lbl := Label.new()
	lbl.custom_minimum_size = Vector2(360, 0)
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(170, 40)
	btn.pressed.connect(func():
		SaveManager.buy_perk(id)
		_refresh())
	row.add_child(lbl)
	row.add_child(btn)
	perks_box.add_child(row)
	_rows[id] = { "label": lbl, "button": btn }

func _buy_orbs() -> void:
	if not SaveManager.is_unlocked(ORBS_UNLOCK) and SaveManager.spend_lost_tickets(ORBS_COST):
		SaveManager.unlock(ORBS_UNLOCK)
	_refresh()

func _refresh() -> void:
	tickets_label.text = "Lost Tickets: %d" % SaveManager.lost_tickets()
	for id: StringName in _rows:
		var p: Dictionary = SaveManager.PERKS[id]
		var lvl: int = SaveManager.perk_level(id)
		_rows[id].label.text = "%s    Lv %d/%d" % [p.label, lvl, int(p.cap)]
		var btn: Button = _rows[id].button
		if SaveManager.perk_maxed(id):
			btn.text = "MAX"
			btn.disabled = true
		else:
			btn.text = "Buy (%d)" % SaveManager.perk_cost(id)
			btn.disabled = not SaveManager.can_buy_perk(id)
	if SaveManager.is_unlocked(ORBS_UNLOCK):
		unlock_btn.text = "Crystal Orbs — UNLOCKED"
		unlock_btn.disabled = true
	else:
		unlock_btn.text = "Unlock Crystal Orbs  (%d)" % ORBS_COST
		unlock_btn.disabled = SaveManager.lost_tickets() < ORBS_COST
	pedia_label.text = "Carnival-pedia: %d discovered" % SaveManager.meta.pedia.size()
