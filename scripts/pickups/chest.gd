extends Area2D
## Reward chest (03 §6, 05). Pooled. Layer PICKUP — the player's magnet "opens"
## it on contact, instantly granting `rolls` VS-style upgrades to already-equipped
## items (ChestReward). Boss chests roll big; miniboss chests roll 1–7.

@onready var visual: Blob = $Visual

## How many random equipped-item upgrades this chest grants. Set on spawn.
var rolls: int = 1

var _opened: bool = false
var _pulse: float = 0.0

func _ready() -> void:
	collision_layer = CollisionLayers.PICKUP
	collision_mask = 0
	set_deferred(&"monitorable", true)

func magnetize() -> void:
	if _opened:
		return
	_opened = true
	# magnetize() is called from the player magnet's area_entered (a query flush) —
	# defer the grant + pool release out of the callback.
	call_deferred(&"_open")

func _open() -> void:
	if GameState.player:
		ChestReward.grant(GameState.player as Player, rolls)
	AudioManager.play_sfx(&"chest")
	ObjectPool.release(self)

func _process(delta: float) -> void:
	_pulse += delta
	if visual:
		visual.scale = Vector2.ONE * (1.0 + 0.15 * sin(_pulse * 4.0))

func _on_acquired() -> void:
	_opened = false
	_pulse = 0.0
	rolls = 1                 # spawner overrides this right after acquire
	show()
	set_process(true)
	set_deferred(&"monitorable", true)

func _on_released() -> void:
	hide()
	set_process(false)
	set_deferred(&"monitorable", false)
