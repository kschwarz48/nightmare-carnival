extends Node
## The run's single source of truth (08_core_systems_implementation.md §5).
## Enemies read GameState.player.global_position — they never search for it.

var player: Node2D = null
var difficulty: DifficultyData
var character: CharacterData

var run_time: float = 0.0          # seconds elapsed this run
var is_running: bool = false
var is_paused: bool = false

var enemies_alive: int = 0
var enemies_killed: int = 0
var bosses_killed: int = 0
var tickets: int = 0
var gold: int = 0

var _tick_accum: float = 0.0

func _process(delta: float) -> void:
	if is_running and not is_paused:
		run_time += delta
		# Emit a ~1Hz tick for HUD/director without per-frame string work.
		_tick_accum += delta
		if _tick_accum >= 1.0:
			_tick_accum -= 1.0
			EventBus.time_tick.emit(run_time)

func run_minutes() -> float:
	return run_time / 60.0

func start_run(p_character: CharacterData, p_difficulty: DifficultyData) -> void:
	character = p_character
	difficulty = p_difficulty
	run_time = 0.0
	_tick_accum = 0.0
	is_running = true
	is_paused = false
	enemies_alive = 0
	enemies_killed = 0
	bosses_killed = 0
	tickets = 0
	gold = 0
	EventBus.run_started.emit(p_character, p_difficulty)

func end_run(did_win: bool) -> void:
	if not is_running:
		return
	is_running = false
	var stats := {
		"won": did_win,
		"time": run_time,
		"kills": enemies_killed,
		"bosses": bosses_killed,
		"lost_tickets": _payout(did_win),
	}
	EventBus.run_ended.emit(did_win, stats)

## Lost Tickets earned this run (01 §8). end_run only computes it — the
## ResultsScreen credits it to the SaveManager exactly once.
func _payout(did_win: bool) -> int:
	var greed: float = 1.0
	if difficulty:
		greed += difficulty.greed_bonus
	var base := floori(run_time / 6.0) + 50 * bosses_killed + floori(float(enemies_killed) / 25.0)
	if did_win:
		base += 100
	return int(round(float(base) * greed))

func set_paused(value: bool) -> void:
	is_paused = value
	get_tree().paused = value
	EventBus.request_pause.emit(value)
