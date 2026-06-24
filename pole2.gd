extends Node
func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_run()
func _run() -> void:
	await get_tree().process_frame
	var app = load("res://scenes/main/app.tscn").instantiate()
	get_tree().root.add_child(app)
	await get_tree().create_timer(0.8).timeout
	EventBus.start_run.emit(&"the_carny")
	await get_tree().create_timer(0.8).timeout
	var player = GameState.player
	player.health.invincible = false
	# build a pole directly on the player to measure tick rate
	var pole = load("res://scenes/bosses/rotating_pole.tscn").instantiate()
	app._current.add_child(pole)
	pole.global_position = player.global_position
	# overlap: move the player onto the bar (bar extends +x from pole pivot)
	player.global_position = pole.global_position + Vector2(120, 0)
	var hp0 = player.health.current_health
	var events := 0
	player.health.damaged.connect(func(_i): events += 1)
	for i in 60: await get_tree().physics_frame   # ~1s
	var lost = hp0 - player.health.current_health
	print("[pole] damage events in ~1s=", events, " hp_lost=", lost, " (expect ~2 ticks x18=~36, NOT instant death)")
	print("RESULT: ", "PASS" if events >= 1 and events <= 4 and player.health.current_health > 0 else "FAIL")
	get_tree().quit(0)
