class_name EventRunner
extends RefCounted
## Runs a carnival event (03 §5). Dispatches by EventData.type and emits the
## carnival_event_started/ended pair so HUD/audio can react. Instant spawn-events
## emit both immediately; timed hazard events will host a runner node in M5.

static func run(ev: EventData) -> void:
	if ev == null:
		return
	EventBus.carnival_event_started.emit(ev)
	match ev.type:
		&"elite_pack":
			_spawn_pack(ev, true)
		&"miniboss":
			_spawn_pack(ev, false)
		_:
			push_warning("EventRunner: unknown event type %s" % ev.type)
	EventBus.carnival_event_ended.emit(ev)

## Spawn `count` of an enemy in a ring around the player (elites if `elite`).
static func _spawn_pack(ev: EventData, elite: bool) -> void:
	var ed := ContentDB.get_enemy(ev.params.get("enemy_id", &""))
	if ed == null or not is_instance_valid(GameState.player):
		return
	var center: Vector2 = GameState.player.global_position
	var count := int(ev.params.get("count", 4))
	for i in count:
		var pos := center + Vector2.from_angle(randf() * TAU) * randf_range(240.0, 380.0)
		EnemyDirector.spawn_add(ed, pos, elite)
