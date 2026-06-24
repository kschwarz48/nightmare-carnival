class_name BossData
extends Resource
## A boss definition (08 §17, 05). Stats + the scene to spawn at its gate; the
## boss scene's script builds its own phases/attacks (programmer-art M3).

@export var id: StringName = &""
@export var display_name: String = "Boss"
@export var scene: PackedScene
@export var max_health: float = 4000.0
@export var contact_damage: float = 16.0
@export var soft_enrage_time: float = 100.0
## When (run seconds) the dormant boss wakes up.
@export var gate_time: float = 360.0
## Visible as scenery before it wakes? The Tent is (the "this prop IS the boss"
## reveal); later bosses stay hidden until their gate so they don't litter the map.
@export var visible_when_dormant: bool = false
## Roam toward the player once active; stops at preferred_distance. Below the
## player's speed so it pressures/looms but can't "jump" on a fleeing player.
@export var move_speed: float = 150.0
@export var preferred_distance: float = 340.0
# --- programmer-art visual (replaced by SpriteFrames at M6) ---
@export var color: Color = Color(0.85, 0.2, 0.3)
@export var radius: float = 90.0
@export var bar_color: Color = Color(0.9, 0.2, 0.25)
