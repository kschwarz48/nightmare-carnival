extends Node
## Music + SFX playback (07 §6, 02 §9). SFX is still a no-op stub.
## Run music = an intro track played once, then a loop track repeated seamlessly
## for the rest of the level. The intro plays with looping OFF (so `finished`
## fires when it ends); on that signal we hand off to the loop track with looping
## ON (so it repeats gap-free). The full layered/intensity system is M6 (09 §M6).

const INTRO := "res://assets/audio/music/circus_intro.wav"
const LOOP := "res://assets/audio/music/circus_loop.wav"

## Balance/mix value — never bury it in logic (.cursorrules).
@export var music_volume_db: float = -6.0

var _music_player: AudioStreamPlayer

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

func stop_music() -> void:
	if _music_player:
		_music_player.stop()             # stop() doesn't emit finished — halts cleanly

func set_intensity(_value: float) -> void:
	pass

func _play(path: String, looping: bool) -> void:
	var stream: AudioStream = load(path)
	if stream is AudioStreamWAV:
		if looping:
			# Seamless full-track loop. Derive frames from length×rate so it's
			# correct regardless of import compression (QOA/PCM).
			stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
			stream.loop_begin = 0
			stream.loop_end = int(round(stream.get_length() * stream.mix_rate))
		else:
			stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
	_music_player.stream = stream
	_music_player.play()

## The intro ends → hand off to the looping track (which then repeats forever, so
## `finished` won't fire again).
func _on_track_finished() -> void:
	_play(LOOP, true)

func _on_run_started(_character: Resource, _difficulty: Resource) -> void:
	_play(INTRO, false)

func _on_run_ended(_did_win: bool, _stats: Dictionary) -> void:
	stop_music()
