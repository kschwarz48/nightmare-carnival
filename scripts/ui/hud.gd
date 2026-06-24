extends CanvasLayer
## Run HUD + debug overlay (08 §20). Reads GameState + player each frame; only
## the time string is event-driven (it changes ~1Hz).

@onready var time_label: Label = %TimeLabel
@onready var level_label: Label = %LevelLabel
@onready var debug_label: Label = %DebugLabel
@onready var hp_bar: ProgressBar = %HPBar
@onready var hp_label: Label = %HPLabel
@onready var xp_bar: ProgressBar = %XPBar
@onready var weapons_label: Label = %WeaponsLabel
@onready var passives_label: Label = %PassivesLabel
@onready var _hp_fill: StyleBoxFlat = hp_bar.get_theme_stylebox(&"fill") as StyleBoxFlat
@onready var boss_panel: VBoxContainer = %BossPanel
@onready var boss_name: Label = %BossName
@onready var boss_bar: ProgressBar = %BossBar
@onready var boss_warning: Label = %BossWarning

const HP_BASE := Color(0.85, 0.2, 0.2)
const HP_FLASH_TIME := 0.16

var _loadout_dirty: bool = true
var _hp_flash: float = 0.0
var _boss: Node = null
var _warn_t: float = 0.0

func _ready() -> void:
	EventBus.time_tick.connect(_on_time_tick)
	EventBus.run_ended.connect(_on_run_ended)
	# Rebuild the loadout readout only when it changes (picks), not every frame.
	EventBus.upgrade_chosen.connect(func(_u): _loadout_dirty = true)
	# Flash the HP bar white on every damage tick.
	EventBus.player_damaged.connect(func(_amt, _hp): _hp_flash = HP_FLASH_TIME)
	# Boss incoming / bar / cleared.
	EventBus.boss_warning.connect(_on_boss_warning)
	EventBus.boss_spawned.connect(_on_boss_spawned)
	EventBus.boss_defeated.connect(_on_boss_defeated)
	boss_panel.visible = false
	boss_warning.visible = false
	_on_time_tick(0.0)

func _process(_delta: float) -> void:
	var player := GameState.player as Player
	if player == null:
		return
	hp_bar.max_value = player.health.max_health
	hp_bar.value = player.health.current_health
	hp_label.text = "%d / %d" % [int(ceil(player.health.current_health)), int(player.health.max_health)]

	var ls := player.level_system
	level_label.text = "Lv %d" % ls.level
	xp_bar.max_value = ls.xp_to_next
	xp_bar.value = ls.xp

	debug_label.text = "FPS %d   Enemies %d   Kills %d" % [
		Engine.get_frames_per_second(), GameState.enemies_alive, GameState.enemies_killed
	]

	# Loadout readout — refresh on change only (also catches the starting weapon
	# on the first frame the player exists).
	if _loadout_dirty:
		_loadout_dirty = false
		_refresh_loadout(player)

	# HP bar damage flash: snap to white on a hit, ease back to red.
	if _hp_fill and _hp_flash > 0.0:
		_hp_flash -= _delta
		_hp_fill.bg_color = HP_BASE.lerp(Color.WHITE, clampf(_hp_flash / HP_FLASH_TIME, 0.0, 1.0))
		if _hp_flash <= 0.0:
			_hp_fill.bg_color = HP_BASE

	# Boss warning banner timer + boss HP bar tracking.
	if _warn_t > 0.0:
		_warn_t -= _delta
		if _warn_t <= 0.0:
			boss_warning.visible = false
	if _boss != null and is_instance_valid(_boss):
		boss_bar.value = _boss.health.get_ratio()

func _on_boss_warning(display_name: String) -> void:
	boss_warning.text = display_name.to_upper() + " APPROACHES"
	boss_warning.visible = true
	_warn_t = 2.0

func _on_boss_spawned(boss: Node, data: Resource) -> void:
	_boss = boss
	boss_name.text = data.display_name
	boss_bar.value = 1.0
	boss_panel.visible = true

func _on_boss_defeated(_boss: Node, _data: Resource) -> void:
	_boss = null
	boss_panel.visible = false

func _refresh_loadout(player: Player) -> void:
	var wpns: Array[String] = []
	for wid in player.weapon_manager.weapons:
		var w: Weapon = player.weapon_manager.weapons[wid]
		wpns.append("%s L%d" % [w.data.display_name, w.level])
	weapons_label.text = "WEAPONS  " + ("   ".join(wpns) if not wpns.is_empty() else "—")

	var pas: Array[String] = []
	for pid in player.owned_passives:
		var pd: PassiveData = player.owned_passives[pid]
		pas.append("%s x%d" % [pd.display_name, int(player.passive_levels.get(pid, 0))])
	passives_label.text = "PASSIVES  " + ("   ".join(pas) if not pas.is_empty() else "—")

func _on_time_tick(seconds: float) -> void:
	var total := int(seconds)
	time_label.text = "%02d:%02d" % [total / 60, total % 60]

func _on_run_ended(did_win: bool, _stats: Dictionary) -> void:
	time_label.text = "DAWN" if did_win else "GAME OVER"
