extends Node
## Music + SFX playback (07 §6, 02 §9). SFX is still a no-op stub for M1; basic
## looping music is live now. The full layered/dynamic-intensity system is M6
## (09 §M6) — this is a single-track bed driven off the run lifecycle.

## Logical track id -> imported audio resource.
const MUSIC: Dictionary = {
	&"day": "res://assets/audio/music/day_theme.wav",
}

## Balance/mix value — never bury it in logic (.cursorrules).
@export var music_volume_db: float = -6.0

var _music_player: AudioStreamPlayer
var _current_music: StringName = &""

func _ready() -> void:
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = &"Master"        # dedicated Music bus arrives with M6 audio pass
	_music_player.volume_db = music_volume_db
	add_child(_music_player)
	# Cross-system wiring goes through EventBus, not hard calls (07 §7).
	EventBus.run_started.connect(_on_run_started)
	EventBus.run_ended.connect(_on_run_ended)

func play_sfx(_id: StringName) -> void:
	pass

func play_music(id: StringName) -> void:
	if id == _current_music and _music_player.playing:
		return
	if not MUSIC.has(id):
		return
	# Looping is configured on the imported asset (edit/loop_mode in the .import)
	# so it works regardless of the compression Godot applies (QOA/IMA/PCM).
	var stream: AudioStream = load(MUSIC[id])
	_current_music = id
	_music_player.stream = stream
	_music_player.play()

func stop_music() -> void:
	_current_music = &""
	if _music_player:
		_music_player.stop()

func set_intensity(_value: float) -> void:
	pass

func _on_run_started(_character: Resource, _difficulty: Resource) -> void:
	play_music(&"day")

func _on_run_ended(_did_win: bool, _stats: Dictionary) -> void:
	stop_music()
