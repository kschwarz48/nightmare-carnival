extends Control
## Title screen (07 §4). Play → character select; Lost & Found; Quit.

@onready var tickets_label: Label = %Tickets
@onready var play_btn: Button = %Play
@onready var lf_btn: Button = %LostAndFound
@onready var quit_btn: Button = %Quit

func _ready() -> void:
	tickets_label.text = "Lost Tickets: %d" % SaveManager.lost_tickets()
	play_btn.pressed.connect(func(): EventBus.goto_character_select.emit())
	lf_btn.pressed.connect(func(): EventBus.goto_lost_and_found.emit())
	quit_btn.pressed.connect(func(): get_tree().quit())
	play_btn.grab_focus()
