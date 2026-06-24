extends Node
## Meta-progression persistence (08 §18). Lost Tickets, unlocks, pedia, settings.

const SAVE_PATH := "user://nightmare_carnival.save"

## Lost & Found stat perks (01 §9). Each level adds `mag` on its PlayerStats axis
## (see PlayerStats.apply_passive); cost escalates by `growth`, capped at `cap`.
## Total budget is deliberately ≈ 2–3 good in-run upgrades (meta = head start).
const PERKS := {
	&"max_hp":  {"label": "Max HP",        "axis": &"max_health", "mag": 0.06, "base": 30,  "growth": 1.5, "cap": 5},
	&"might":   {"label": "Might",         "axis": &"might",      "mag": 0.05, "base": 40,  "growth": 1.6, "cap": 5},
	&"speed":   {"label": "Move Speed",    "axis": &"move_speed", "mag": 0.04, "base": 35,  "growth": 1.6, "cap": 4},
	&"pickup":  {"label": "Pickup Radius", "axis": &"pickup",     "mag": 0.10, "base": 25,  "growth": 1.5, "cap": 4},
	&"revive":  {"label": "Starting Revive","axis": &"revive",    "mag": 1.0,  "base": 200, "growth": 2.0, "cap": 1},
}

var meta := {
	"lost_tickets": 0,
	"unlocks": [],            # ids of unlocked characters/weapons/zones
	"perks": {},              # perk_id -> level
	"pedia": [],              # discovered enemy/boss ids
	"settings": {},
}

func _ready() -> void:
	load_game()

func lost_tickets() -> int:
	return int(meta.lost_tickets)

func add_lost_tickets(amount: int) -> void:
	meta.lost_tickets += amount
	save_game()

func spend_lost_tickets(amount: int) -> bool:
	if int(meta.lost_tickets) < amount:
		return false
	meta.lost_tickets -= amount
	save_game()
	return true

# --- meta stat perks (Lost & Found, 01 §9) ---
func perk_level(id: StringName) -> int:
	return int(meta.perks.get(String(id), 0))

func perk_cost(id: StringName) -> int:
	if not PERKS.has(id):
		return 0
	var p: Dictionary = PERKS[id]
	return int(round(float(p.base) * pow(float(p.growth), perk_level(id))))

func perk_maxed(id: StringName) -> bool:
	return PERKS.has(id) and perk_level(id) >= int(PERKS[id].cap)

func can_buy_perk(id: StringName) -> bool:
	return PERKS.has(id) and not perk_maxed(id) and int(meta.lost_tickets) >= perk_cost(id)

func buy_perk(id: StringName) -> bool:
	if not can_buy_perk(id):
		return false
	meta.lost_tickets -= perk_cost(id)
	meta.perks[String(id)] = perk_level(id) + 1
	save_game()
	return true

## Apply all owned perks to a fresh PlayerStats at run start (player.gd).
func apply_meta_perks(stats: PlayerStats) -> void:
	for id: StringName in PERKS:
		var lvl := perk_level(id)
		if lvl > 0:
			var p: Dictionary = PERKS[id]
			stats.apply_passive(p.axis, float(p.mag) * float(lvl))

# --- settings (pause/options, persisted) ---
func get_setting(key: StringName, default_value: Variant) -> Variant:
	return meta.settings.get(String(key), default_value)

func set_setting(key: StringName, value: Variant) -> void:
	meta.settings[String(key)] = value
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
