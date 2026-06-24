extends Node
## The run's pulse (08 §13): spawn ring, wave selection, time/difficulty
## scaling, population cap, elites, boss gates, and the separation service.

const ENEMY_SCENE := preload("res://scenes/enemies/enemy.tscn")

@export var spawn_margin: float = 80.0
## On-screen half-extent in world units (≈ half of a 1920×1080 view at zoom 1).
## Used for the spawn band + despawn leash — a fixed world distance, independent
## of the actual viewport/zoom (and reliable in headless tests).
const VIEW_HALF := Vector2(980.0, 560.0)

var waves: Array[WaveData] = []

var _interval_accum: float = 0.0
var _swarm_accum: float = 0.0
var _current_wave_id: StringName = &""    # for one-shot on-enter effects (elite burst)
var _active: Array = []                   # active enemies (hash + cap + queries)
var _hash := SpatialHash.new()
var _frame: int = 0
var _running: bool = false
var _boss_active: bool = false            # pauses ambient spawns during a set-piece boss
var _bosses: Array = []                   # active bosses (targetable by weapon auto-aim)

func start() -> void:
	_active.clear()
	_bosses.clear()
	_interval_accum = 0.0
	_swarm_accum = 0.0
	_current_wave_id = &""
	_frame = 0
	_boss_active = false
	_running = true
	if not EventBus.enemy_died.is_connected(_on_enemy_died):
		EventBus.enemy_died.connect(_on_enemy_died)
	if not EventBus.boss_spawned.is_connected(_on_boss_spawned):
		EventBus.boss_spawned.connect(_on_boss_spawned)
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
	if _frame % 10 == 0:
		_cull_offscreen()        # despawn enemies the player has left behind (VS leash)
	_spawn_step(_delta)

# --- spawning (VS-style wave rules; 03 §7.4) ---
func _spawn_step(delta: float) -> void:
	if _boss_active:
		return                       # set-piece boss: ambient spawns pause (03 §8)
	var wave := _active_wave()
	if wave == null:
		return
	var minutes := GameState.run_minutes()
	var cap: int = mini(wave.max_alive, _cap())

	# On entering a new wave, run its one-shot effects (e.g. the elite gauntlet).
	if wave.id != _current_wave_id:
		_current_wave_id = wave.id
		_swarm_accum = 0.0
		for _i in wave.elite_burst:
			if _active.size() >= _cap():
				break
			_spawn_one(minutes, wave, true)

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

	# 3) Overlay: periodic cross-screen flyby swarm ("dodge this").
	if wave.swarm_enemy != null and wave.swarm_interval > 0.0:
		_swarm_accum += delta
		while _swarm_accum >= wave.swarm_interval:
			_swarm_accum -= wave.swarm_interval
			_spawn_swarm(wave, minutes)

## Latest-started active wave (waves are sorted ascending, so the last match
## wins — lets a short burst wave temporarily override the base timeline).
func _active_wave() -> WaveData:
	var seconds := GameState.run_time
	var best: WaveData = null
	for w: WaveData in waves:
		if w.is_active(seconds):
			best = w
	return best

func _spawn_one(minutes: float, wave: WaveData, force_elite: bool = false) -> bool:
	var ed := _pick_enemy(wave)
	if ed == null:
		return false
	var e := ObjectPool.acquire(ENEMY_SCENE, _enemy_layer()) as Enemy
	e.global_position = _spawn_point()
	var elite := ed.can_be_elite and (force_elite or randf() < _elite_chance(minutes))
	e.configure(ed, _hp_mult(minutes), _dmg_mult(minutes), _spd_mult(minutes), elite)
	_active.append(e)
	return true

## Spawn a flyby swarm: a tight, touching cluster of fast enemies — a "school of
## fish" — that streaks across the whole play area together from one random angle
## and out the far side (FlybyBehavior; flyby bodies don't collide, so they stay
## packed). One shared heading, one tight blob.
func _spawn_swarm(wave: WaveData, minutes: float) -> void:
	var center: Vector2 = GameState.player.global_position
	var ring := VIEW_HALF.length() + 90.0
	var ang := randf() * TAU                           # the side it comes from
	var dir := -Vector2.from_angle(ang)               # heading: across, through center
	var cluster_center := center + Vector2.from_angle(ang) * ring
	var spread := clampf(float(wave.swarm_size) * 2.6, 50.0, 190.0)
	for _i in wave.swarm_size:
		if _active.size() >= _cap():
			break
		# Disk-uniform offset (sqrt) keeps the school dense rather than ring-heavy.
		var off := Vector2.from_angle(randf() * TAU) * (sqrt(randf()) * spread)
		var e := ObjectPool.acquire(ENEMY_SCENE, _enemy_layer()) as Enemy
		e.global_position = cluster_center + off
		e.configure(wave.swarm_enemy, _hp_mult(minutes), _dmg_mult(minutes), _spd_mult(minutes), false)
		e.set_meta(&"flyby_dir", dir)
		_active.append(e)

## Spawn a single add at a position (boss summons — Concession Spew, Clown Call).
func spawn_add(ed: EnemyData, pos: Vector2, elite: bool = false) -> void:
	if ed == null or _active.size() >= _cap():
		return
	var minutes := GameState.run_minutes()
	var e := ObjectPool.acquire(ENEMY_SCENE, _enemy_layer()) as Enemy
	e.global_position = pos.clamp(MapBounds.min_pos, MapBounds.max_pos)
	e.configure(ed, _hp_mult(minutes), _dmg_mult(minutes), _spd_mult(minutes), elite and ed.can_be_elite)
	_active.append(e)

## True once `pos` has exited the screen edge in its travel direction.
func past_screen(pos: Vector2, dir: Vector2, margin: float = 120.0) -> bool:
	if GameState.player == null:
		return true
	var center: Vector2 = GameState.player.global_position
	var half := VIEW_HALF
	if dir.x > 0.1 and pos.x > center.x + half.x + margin: return true
	if dir.x < -0.1 and pos.x < center.x - half.x - margin: return true
	if dir.y > 0.1 and pos.y > center.y + half.y + margin: return true
	if dir.y < -0.1 and pos.y < center.y - half.y - margin: return true
	return false

## Release a non-killed enemy (flyby exit) — no ticket drop, just recycle.
func despawn(e: Node) -> void:
	if not is_instance_valid(e):
		return
	_remove(e)
	GameState.enemies_alive -= 1
	ObjectPool.release(e)

## A point in the rectangular band around the player: outside the on-screen rect
## (½ viewport) out to ~1.5×, clamped to bounds, avoiding stacking on existing
## enemies (VS-style spawn area + spawn blocking; 03 §7).
func _spawn_point() -> Vector2:
	var center: Vector2 = GameState.player.global_position
	var half := VIEW_HALF
	var outer := half * 1.5
	for _attempt in 8:
		var pt := center + Vector2(randf_range(-outer.x, outer.x), randf_range(-outer.y, outer.y))
		# Keep it off-screen (outside the inner on-screen rect).
		if absf(pt.x - center.x) < half.x and absf(pt.y - center.y) < half.y:
			continue
		pt = pt.clamp(MapBounds.min_pos, MapBounds.max_pos)
		if not _blocked(pt):
			return pt
	# Fallback: just off the right edge.
	return (center + Vector2(half.x + spawn_margin, randf_range(-half.y, half.y))).clamp(MapBounds.min_pos, MapBounds.max_pos)

## True if an enemy is already very close to pt (don't spawn on top of one).
func _blocked(pt: Vector2) -> bool:
	for e in _hash.query(pt):
		if is_instance_valid(e) and pt.distance_squared_to(e.global_position) < 28.0 * 28.0:
			return true
	return false

## Despawn normal enemies the player has left behind — outside ~1.7× the viewport
## half-rect around the player (VS leash; bosses aren't in _active so they stay).
func _cull_offscreen() -> void:
	var center: Vector2 = GameState.player.global_position
	var limit := VIEW_HALF * 1.7
	for e in _active.duplicate():
		if not is_instance_valid(e):
			continue
		var off: Vector2 = (e.global_position - center).abs()
		if off.x > limit.x or off.y > limit.y:
			despawn(e)

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

# --- bosses (08 §17, 03 §8) ---
# The boss is placed dormant at run start and self-activates at its gate; the
# director only pauses/resumes ambient waves around it.
func _on_boss_spawned(boss: Node, _bdata: Resource) -> void:
	_boss_active = true                 # set-piece: ambient spawns pause
	if boss is Node2D and not _bosses.has(boss):
		_bosses.append(boss)            # so weapon auto-aim can target it

func _on_boss_defeated(boss: Node, bdata: Resource) -> void:
	GameState.bosses_killed += 1
	_boss_active = false               # resume ambient waves
	_bosses.erase(boss)
	if bdata and bdata.id != &"":
		SaveManager.discover(bdata.id)  # Carnival-pedia (01 §9)

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
	# Bosses aren't in _active (no body collision) but must still be auto-targeted.
	for b in _bosses:
		if not is_instance_valid(b):
			continue
		var d: float = from.distance_squared_to(b.global_position)
		if d < best_d:
			best_d = d
			best = b
	return best

func get_random_enemy_near(from: Vector2, radius: float) -> Node2D:
	var near: Array = []
	var r2 := radius * radius
	for e in _active:
		if is_instance_valid(e) and from.distance_squared_to(e.global_position) <= r2:
			near.append(e)
	for b in _bosses:
		if is_instance_valid(b) and from.distance_squared_to(b.global_position) <= r2:
			near.append(b)
	return near.pick_random() if not near.is_empty() else null

func _on_enemy_died(enemy: Node, _position: Vector2) -> void:
	_remove(enemy)
	if enemy is Enemy and (enemy as Enemy).data:
		SaveManager.discover((enemy as Enemy).data.id)   # Carnival-pedia (01 §9)

func _remove(e: Node) -> void:
	var i := _active.find(e)
	if i != -1:
		_active.remove_at(i)

func _enemy_layer() -> Node:
	return GameState.enemy_layer
