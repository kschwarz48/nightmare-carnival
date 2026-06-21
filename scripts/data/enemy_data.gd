class_name EnemyData
extends Resource
## Data-driven enemy definition (08 §10, 04_enemy_bible.md). One enemy.tscn shell
## is configured at spawn from one of these. New enemy = new .tres.

@export var id: StringName = &""
@export var display_name: String = ""
@export var max_health: float = 10.0
@export var move_speed: float = 60.0
@export var contact_damage: float = 8.0
@export var ticket_value: int = 1
@export var behavior: StringName = &"chaser"        # maps to a behavior script (§11)

# --- programmer-art visual (replaced by SpriteFrames at M6) ---
@export var color: Color = Color(0.9, 0.3, 0.3)
@export var radius: float = 12.0
@export var sprite_frames: SpriteFrames             # unused until final art

@export var separation_radius: float = 14.0
@export var can_be_elite: bool = true
@export var death_vfx: PackedScene
@export var hit_sfx: StringName = &""
@export var death_sfx: StringName = &""
## Optional per-behavior tuning bag (charge_speed, shoot_range, burst_cooldown...).
@export var params: Dictionary = {}
