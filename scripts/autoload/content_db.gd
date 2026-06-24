extends Node
## Loads every .tres in resources/ once and exposes typed lists (08 §9).
## Designers/Cursor add content by dropping a .tres in the right folder.

var _characters: Array[CharacterData] = []
var _difficulties: Array[DifficultyData] = []
var _weapons: Array[WeaponData] = []
var _enemies: Array[EnemyData] = []
var _upgrades: Array[UpgradeData] = []
var _waves: Array[WaveData] = []
var _bosses: Array[BossData] = []

func _ready() -> void:
	_load_dir("res://resources/characters/", _characters)
	_load_dir("res://resources/difficulties/", _difficulties)
	_load_dir("res://resources/weapons/", _weapons)
	_load_dir("res://resources/enemies/", _enemies)
	_load_dir("res://resources/upgrades/", _upgrades)
	_load_dir("res://resources/waves/", _waves)
	_load_dir("res://resources/bosses/", _bosses)
	_waves.sort_custom(func(a, b): return a.start_time < b.start_time)
	_bosses.sort_custom(func(a, b): return a.gate_time < b.gate_time)

func _load_dir(path: String, into: Array) -> void:
	var dir := DirAccess.open(path)
	if dir == null:
		return
	dir.list_dir_begin()
	var file := dir.get_next()
	while file != "":
		if not dir.current_is_dir() and (file.ends_with(".tres") or file.ends_with(".res")):
			var res := load(path + file)
			if res != null:
				into.append(res)
		file = dir.get_next()
	dir.list_dir_end()

func all_characters() -> Array[CharacterData]: return _characters
func all_difficulties() -> Array[DifficultyData]: return _difficulties
func all_upgrades() -> Array[UpgradeData]: return _upgrades
func all_waves() -> Array[WaveData]: return _waves
func all_bosses() -> Array[BossData]: return _bosses

func get_boss(id: StringName) -> BossData:
	for b in _bosses:
		if b.id == id:
			return b
	return null

func get_character(id: StringName) -> CharacterData:
	for c in _characters:
		if c.id == id:
			return c
	return _characters[0] if not _characters.is_empty() else null

func get_difficulty(id: StringName) -> DifficultyData:
	for d in _difficulties:
		if d.id == id:
			return d
	return _difficulties[0] if not _difficulties.is_empty() else null
