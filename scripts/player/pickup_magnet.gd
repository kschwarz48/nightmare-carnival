extends Area2D
## The player's pickup-radius area (08 §14). Layer PICKUP_MAGNET, mask PICKUP.
## On overlap it tells a pickup to fly toward the player.

func _ready() -> void:
	collision_layer = CollisionLayers.PICKUP_MAGNET
	collision_mask = CollisionLayers.PICKUP
	monitoring = true
	monitorable = false
	area_entered.connect(_on_area_entered)

func _on_area_entered(area: Area2D) -> void:
	if area.has_method(&"magnetize"):
		area.call(&"magnetize")
