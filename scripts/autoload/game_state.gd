extends Node
## The run's single source of truth (08_core_systems_implementation.md §5).
## Enemies read GameState.player.global_position — they never search for it.

var player: Node2D = null
var difficulty: DifficultyData
var character: CharacterData

# The active run's spawn layers, registered by game.gd. Autoloads/weapons read
# these instead of get_tree().current_scene (the run is nested under the App root,
# so it can't be the SceneTree's current_scene).
var actor_layer: Node = null
var enemy_layer: Node = null
var projectile_layer: Node = null
var pickup_layer: Node = null

var run_time: float = 0.0          # seconds elapsed this run
var is_running: bool = false
var is_paused: bool = false

var enemies_alive: int = 0
var enemies_killed: int = 0
var bosses_killed: int = 0
var tickets: int = 0
var gold: int = 0

## Act boundaries in run-seconds (Act II/III/IV start; 01 §5). Act I is 0–6:00.
const ACT_GATES: Array[float] = [360.0, 720.0, 1080.0]
## Survive to Dawn = win (01 §5, §11).
const WIN_TIME: float = 1500.0     # 25:00

var act: int = 1
var _tick_accum: float = 0.0

func _process(delta: float) -> void:
	if is_running and not is_paused:
		run_time += delta
		if run_time >= WIN_TIME:
			end_run(true)              # Dawn — survived the night
			return
		_update_act()
		# Emit a ~1Hz tick for HUD/director without per-frame string work.
		_tick_accum += delta
		if _tick_accum >= 1.0:
			_tick_accum -= 1.0
			EventBus.time_tick.emit(run_time)

## Drive the Act timeline (01 §5): emit act_changed when a gate is crossed so the
## director/HUD/music can react. Content keys ambient pools etc. off the act.
func _update_act() -> void:
	var a := 1
	for g in ACT_GATES:
		if run_time >= g:
			a += 1
	if a != act:
		act = a
		EventBus.act_changed.emit(act)

func run_minutes() -> float:
	return run_time / 60.0

func start_run(p_character: CharacterData, p_difficulty: DifficultyData) -> void:
	character = p_character
	difficulty = p_difficulty
	run_time = 0.0
	act = 1
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
