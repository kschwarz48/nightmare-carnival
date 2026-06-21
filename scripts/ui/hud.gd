extends CanvasLayer
## Run HUD + debug overlay (08 §20). Reads GameState + player each frame; only
## the time string is event-driven (it changes ~1Hz).

@onready var time_label: Label = %TimeLabel
@onready var level_label: Label = %LevelLabel
@onready var debug_label: Label = %DebugLabel
@onready var hp_bar: ProgressBar = %HPBar
@onready var hp_label: Label = %HPLabel
@onready var xp_bar: ProgressBar = %XPBar

func _ready() -> void:
	EventBus.time_tick.connect(_on_time_tick)
	EventBus.run_ended.connect(_on_run_ended)
	_on_time_tick(0.0)

func _process(_delta: float) -> void:
	var player := GameState.player as Player
	if player == null:
		return
	hp_bar.max_value = player.health.max_health
	hp_bar.value = player.health.current_health
	hp_label.text = "%d / %d" % [int(ceil(player.health.current_health)), int(player.health.max_health)]

	var ls := player.level_system
	level_label.text = "Lv %d" % ls.level
	xp_bar.max_value = ls.xp_to_next
	xp_bar.value = ls.xp

	debug_label.text = "FPS %d   Enemies %d   Kills %d" % [
		Engine.get_frames_per_second(), GameState.enemies_alive, GameState.enemies_killed
	]

func _on_time_tick(seconds: float) -> void:
	var total := int(seconds)
	time_label.text = "%02d:%02d" % [total / 60, total % 60]

func _on_run_ended(did_win: bool, _stats: Dictionary) -> void:
	time_label.text = "DAWN" if did_win else "GAME OVER"
