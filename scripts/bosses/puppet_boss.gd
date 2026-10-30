extends Boss
## The Puppet King (05 BOSS 3, gate 18:00). Set-piece. P1 dances on its strings;
## P2 the strings become cuttable sub-targets — cut all four to STAGGER him for a
## DPS window (then they regrow); P3 he cuts his own strings and rampages free.
## Marionette Slam reuses Tent-Pole Stomp; String Sweep reuses Pennant Flap.

const STRING := preload("res://scenes/bosses/puppet_string.tscn")

var _strings: Array = []
var _strings_left: int = 0
var _staggering: bool = false

func _build_phases() -> Array[BossPhase]:
	var p1 := BossPhase.new()
	p1.hp_threshold = 1.0
	p1.attacks = [
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),      # Marionette Slam
		preload("res://scripts/bosses/attacks/pennant_flap.gd").new(),    # String Sweep
		preload("res://scripts/bosses/attacks/soldier_levy.gd").new(),
	]
	# P2 keeps slamming while you cut strings; the stagger loop is _on_phase_entered.
	var p2 := BossPhase.new()
	p2.hp_threshold = 0.6
	p2.attacks = [
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),
		preload("res://scripts/bosses/attacks/soldier_levy.gd").new(),
	]
	var p3 := BossPhase.new()
	p3.hp_threshold = 0.3
	p3.attacks = [
		preload("res://scripts/bosses/attacks/puppet_lunge.gd").new(),    # Free Lunge
		preload("res://scripts/bosses/attacks/soldier_levy.gd").new(),    # Last Levy
		preload("res://scripts/bosses/attacks/tent_stomp.gd").new(),
	]
	var out: Array[BossPhase] = [p1, p2, p3]
	return out

func _on_phase_entered(index: int) -> void:
	if index == 1:
		_raise_strings()          # P2: strings up, body invulnerable
	elif index >= 2:
		_clear_strings()          # P3: free and vulnerable

## Hang on four cuttable strings; the body can't be hit until they're all cut.
func _raise_strings() -> void:
	_clear_strings()
	hurtbox.set_deferred(&"monitorable", false)   # body invulnerable while strung up
	_strings_left = 4
	for i in 4:
		var s := STRING.instantiate()
		add_child(s)
		s.position = Vector2.from_angle(TAU * float(i) / 4.0 - PI / 2.0) * 140.0
		s.cut.connect(_on_string_cut)
		_strings.append(s)

func _on_string_cut() -> void:
	_strings_left -= 1
	if _strings_left <= 0 and not _staggering and _phase_index == 1 and _alive:
		_stagger()

## All strings cut → drop, vulnerable and stunned for a window, then re-string.
func _stagger() -> void:
	_staggering = true
	_busy = true                                   # pause the attack loop
	hurtbox.set_deferred(&"monitorable", true)      # exposed!
	visual.set_flash(0.6, Color(1, 1, 1))
	await get_tree().create_timer(4.0, false).timeout
	if not _alive:
		return
	visual.set_flash(0.0)
	_staggering = false
	_busy = false
	if _phase_index == 1:                            # still in P2 → re-string
		_raise_strings()

func _clear_strings() -> void:
	for s in _strings:
		if is_instance_valid(s):
			s.queue_free()
	_strings.clear()
	_strings_left = 0
	_staggering = false
	hurtbox.set_deferred(&"monitorable", true)
