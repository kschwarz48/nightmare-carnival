class_name LevelSystem
extends Node
## Tracks XP/level; opens the draft on level-up (08 §9.1). Listens to ticket pickups.

var level: int = 1
var xp: float = 0.0
var xp_to_next: float = 5.0

func _ready() -> void:
	xp_to_next = _curve(level)
	EventBus.ticket_collected.connect(_on_ticket)

func _on_ticket(value: int) -> void:
	var mult: float = 1.0
	if GameState.player and (GameState.player as Player).stats:
		mult = (GameState.player as Player).stats.xp_gain_mult
	xp += float(value) * mult
	GameState.tickets += value
	while xp >= xp_to_next:
		xp -= xp_to_next
		_level_up()

func _level_up() -> void:
	level += 1
	xp_to_next = _curve(level)
	EventBus.player_leveled_up.emit(level)

func _curve(lvl: int) -> float:
	# Gentle early, steepening later (08 §9.1). Tune freely — it paces choices.
	return 5.0 + float(lvl) * 3.0 + pow(float(lvl), 1.6)
