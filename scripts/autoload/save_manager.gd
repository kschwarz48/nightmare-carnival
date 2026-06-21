extends Node
## Meta-progression persistence (08 §18). Lost Tickets, unlocks, pedia, settings.

const SAVE_PATH := "user://nightmare_carnival.save"

var meta := {
	"lost_tickets": 0,
	"unlocks": [],            # ids of unlocked characters/weapons/zones
	"perks": {},              # perk_id -> level
	"pedia": [],              # discovered enemy/boss ids
	"settings": {},
}

func _ready() -> void:
	load_game()

func add_lost_tickets(amount: int) -> void:
	meta.lost_tickets += amount
	save_game()

func is_unlocked(id: StringName) -> bool:
	return meta.unlocks.has(String(id))

func unlock(id: StringName) -> void:
	if not is_unlocked(id):
		meta.unlocks.append(String(id))
		save_game()

func discover(id: StringName) -> void:
	if not meta.pedia.has(String(id)):
		meta.pedia.append(String(id))
		save_game()

func save_game() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(meta))

func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f:
		var parsed: Variant = JSON.parse_string(f.get_as_text())
		if parsed is Dictionary:
			meta.merge(parsed, true)
