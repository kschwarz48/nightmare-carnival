extends Node
## Music + SFX playback (07 §6, 02 §9). SFX is still a no-op stub for M1.
## Music plays continuously by rotating a playlist: we force each track to NOT
## loop internally and advance on the `finished` signal, so playback is seamless
## across the whole run regardless of import/compression loop quirks. The full
## layered/dynamic-intensity system is M6 (09 §M6).

## Logical track id -> imported audio resource.
const MUSIC: Dictionary = {
	&"day": "res://assets/audio/music/day_theme.wav",
	&"mystery": "res://assets/audio/music/mystery_theme.wav",
}

## Tracks rotated during a run (loops back to the start when it reaches the end).
const GAMEPLAY_PLAYLIST: Array[StringName] = [&"day", &"mystery"]

## Balance/mix value — never bury it in logic (.cursorrules).
@export var music_volume_db: float = -6.0

var _music_player: AudioStreamPlayer
var _playlist: Array[StringName] = []
var _index: int = 0
var _current_music: StringName = &""

func _ready() -> void:
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = &"Master"        # dedicated Music bus arrives with M6 audio pass
	_music_player.volume_db = music_volume_db
	add_child(_music_player)
	_music_player.finished.connect(_on_track_finished)
	# Cross-system wiring goes through EventBus, not hard calls (07 §7).
	EventBus.run_started.connect(_on_run_started)
	EventBus.run_ended.connect(_on_run_ended)

func play_sfx(_id: StringName) -> void:
	pass

## Play a single track on repeat.
func play_music(id: StringName) -> void:
	play_playlist([id] as Array[StringName])

## Play a rotating playlist; wraps to the start so music never stops.
func play_playlist(list: Array[StringName]) -> void:
	if list.is_empty():
		return
	_playlist = list.duplicate()
	_index = 0
	_play_current()

func stop_music() -> void:
	_current_music = &""
	_playlist.clear()
	if _music_player:
		_music_player.stop()        # stop() does not emit finished — rotation halts cleanly

func set_intensity(_value: float) -> void:
	pass

func _play_current() -> void:
	if _playlist.is_empty():
		return
	var id := _playlist[_index]
	if not MUSIC.has(id):
		return
	var stream: AudioStream = load(MUSIC[id])
	# We rotate/loop via the finished signal, so the stream itself must NOT loop
	# (a looping stream never emits `finished`).
	if stream is AudioStreamWAV:
		stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
	_current_music = id
	_music_player.stream = stream
	_music_player.play()

func _on_track_finished() -> void:
	if _playlist.is_empty():
		return
	_index = (_index + 1) % _playlist.size()
	_play_current()

func _on_run_started(_character: Resource, _difficulty: Resource) -> void:
	play_playlist(GAMEPLAY_PLAYLIST)

func _on_run_ended(_did_win: bool, _stats: Dictionary) -> void:
	stop_music()
