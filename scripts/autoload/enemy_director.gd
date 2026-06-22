extends Node
## The run's pulse (08 §13): spawn ring, wave selection, time/difficulty
## scaling, population cap, elites, boss gates, and the separation service.

const ENEMY_SCENE := preload("res://scenes/enemies/enemy.tscn")

@export var spawn_margin: float = 80.0

var waves: Array[WaveData] = []
var boss_gates: Array = []                # [{ "time": 360.0, "boss": BossData, "fired": false }, ...]

var _interval_accum: float = 0.0
var _active: Array = []                   # active enemies (hash + cap + queries)
var _hash := SpatialHash.new()
var _frame: int = 0
var _running: bool = false

func start() -> void:
	_active.clear()
	_interval_accum = 0.0
	_frame = 0
	for g in boss_gates:
		g.fired = false
	_running = true
	if not EventBus.enemy_died.is_connected(_on_enemy_died):
		EventBus.enemy_died.connect(_on_enemy_died)
	if not EventBus.boss_defeated.is_connected(_on_boss_defeated):
		EventBus.boss_defeated.connect(_on_boss_defeated)

func stop() -> void:
	_running = false
	_active.clear()

func _physics_process(_delta: float) -> void:
	if not _running or GameState.is_paused or not GameState.is_running:
		return
	if GameState.player == null:
		return
	_frame += 1
	_hash.rebuild(_active)
	_check_boss_gates()
	_spawn_step(_delta)

# --- spawning (VS-style wave rules; 03 §7.4) ---
func _spawn_step(delta: float) -> void:
	var wave := _active_wave()
	if wave == null:
		return
	var minutes := GameState.run_minutes()
	var cap: int = mini(wave.max_alive, _cap())

	# 1) Keep the baseline crowd: top up instantly when below the wave minimum.
	# Break on a failed spawn (e.g. empty enemy list) so we never spin forever.
	while _active.size() < mini(wave.min_alive, cap):
		if not _spawn_one(minutes, wave):
			break

	# 2) Steady pressure on top: spawn_batch every spawn_interval, up to the cap.
	_interval_accum += delta
	var interval: float = maxf(0.05, wave.spawn_interval)
	while _interval_accum >= interval:
		_interval_accum -= interval
		for _i in wave.spawn_batch:
			if _active.size() >= cap:
				break
			if not _spawn_one(minutes, wave):
				break

## Latest-started active wave (waves are sorted ascending, so the last match
## wins — lets a short burst wave temporarily override the base timeline).
func _active_wave() -> WaveData:
	var seconds := GameState.run_time
	var best: WaveData = null
	for w: WaveData in waves:
		if w.is_active(seconds):
			best = w
	return best

func _spawn_one(minutes: float, wave: WaveData) -> bool:
	var ed := _pick_enemy(wave)
	if ed == null:
		return false
	var e := ObjectPool.acquire(ENEMY_SCENE, _enemy_layer()) as Enemy
	e.global_position = _ring_point()
	var elite := ed.can_be_elite and randf() < _elite_chance(minutes)
	e.configure(ed, _hp_mult(minutes), _dmg_mult(minutes), _spd_mult(minutes), elite)
	_active.append(e)
	return true

func _ring_point() -> Vector2:
	var center: Vector2 = GameState.player.global_position
	var view := get_viewport().get_visible_rect().size
	var radius := view.length() * 0.5 + spawn_margin
	var angle := randf() * TAU
	var pt := center + Vector2.from_angle(angle) * radius
	return pt.clamp(MapBounds.min_pos, MapBounds.max_pos)

func _pick_enemy(wave: WaveData) -> EnemyData:
	var entries := wave.weighted_enemies()
	if entries.is_empty():
		return null
	var total := 0.0
	for pair in entries:
		total += pair[1]
	var r := randf() * total
	var acc := 0.0
	for pair in entries:
		acc += pair[1]
		if r <= acc:
			return pair[0]
	return entries.back()[0]

# --- per-enemy stat scaling over time (03 §7.3); spawn COUNT is wave-driven.
# difficulty mults from GameState.difficulty ---
func _hp_mult(minutes: float) -> float:
	return (1.0 + 0.06 * minutes) * GameState.difficulty.hp_mult
func _dmg_mult(minutes: float) -> float:
	return (1.0 + 0.04 * minutes) * GameState.difficulty.dmg_mult
func _spd_mult(minutes: float) -> float:
	return minf(1.0 + 0.01 * minutes, 1.6)
func _elite_chance(minutes: float) -> float:
	return clampf(0.01 + 0.004 * minutes, 0.0, 0.12)
func _cap() -> int:
	return GameState.difficulty.max_alive

# --- bosses (gates only in M1; framework lands at M3) ---
func _check_boss_gates() -> void:
	var t := GameState.run_time
	for g in boss_gates:
		if not g.fired and t >= g.time:
			g.fired = true
			# Boss spawn implemented at M3.

func _on_boss_defeated(_boss: Node, _bdata: Resource) -> void:
	GameState.bosses_killed += 1

# --- separation service (called by enemies, throttled) ---
func separation_for(enemy: Enemy) -> Vector2:
	if (_frame + enemy.get_instance_id()) % 3 != 0:
		return enemy.get_meta(&"_sep", Vector2.ZERO)
	var push := Vector2.ZERO
	var r := enemy.data.separation_radius
	for other in _hash.query(enemy.global_position):
		if other == enemy or not is_instance_valid(other):
			continue
		var diff: Vector2 = enemy.global_position - other.global_position
		var d := diff.length()
		if d > 0.0 and d < r:
			push += diff / d * (1.0 - d / r)
	enemy.set_meta(&"_sep", push)
	return push

# --- queries for weapon auto-aim ---
func get_nearest_enemy(from: Vector2, max_dist: float) -> Node2D:
	var best: Node2D = null
	var best_d := max_dist * max_dist
	for e in _active:
		if not is_instance_valid(e):
			continue
		var d: float = from.distance_squared_to(e.global_position)
		if d < best_d:
			best_d = d
			best = e
	return best

func get_random_enemy_near(from: Vector2, radius: float) -> Node2D:
	var near: Array = []
	var r2 := radius * radius
	for e in _active:
		if is_instance_valid(e) and from.distance_squared_to(e.global_position) <= r2:
			near.append(e)
	return near.pick_random() if not near.is_empty() else null

func _on_enemy_died(enemy: Node, _position: Vector2) -> void:
	_remove(enemy)

func _remove(e: Node) -> void:
	var i := _active.find(e)
	if i != -1:
		_active.remove_at(i)

func _enemy_layer() -> Node:
	return get_tree().current_scene.get_node(^"%EnemyLayer")
