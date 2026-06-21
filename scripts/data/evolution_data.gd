class_name EvolutionData
extends Resource
## A weapon evolution (06 §5, 08 §9). Authored on a base WeaponData's `evolution`
## field; when the base is maxed and its `required_passive` is owned, the draft
## offers this — picking it replaces the base weapon with `result`.

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var result: WeaponData            # the evolved weapon that replaces the base
@export var icon: Texture2D
