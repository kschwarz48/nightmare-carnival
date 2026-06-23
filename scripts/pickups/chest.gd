extends Area2D
## Boss reward chest (03 §6, 05). Pooled. Layer PICKUP — the player's magnet
## "opens" it on contact, granting a guaranteed draft pick (emits
## player_leveled_up, which the LevelUpDraft turns into a choose-one).

@onready var visual: Blob = $Visual

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
	EventBus.player_leveled_up.emit(0)      # opens the draft for a free pick
	AudioManager.play_sfx(&"chest")
	ObjectPool.release(self)

func _process(delta: float) -> void:
	_pulse += delta
	if visual:
		visual.scale = Vector2.ONE * (1.0 + 0.15 * sin(_pulse * 4.0))

func _on_acquired() -> void:
	_opened = false
	_pulse = 0.0
	show()
	set_process(true)
	set_deferred(&"monitorable", true)

func _on_released() -> void:
	hide()
	set_process(false)
	set_deferred(&"monitorable", false)
