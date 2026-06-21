shader_type canvas_item;
// White-flash-on-hit (08 §4). Assign to sprite materials at M6 once real
// textures exist. M1 programmer art uses Blob.set_flash() instead.
uniform float flash : hint_range(0.0, 1.0) = 0.0;
uniform vec4 flash_color : source_color = vec4(1.0);

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
	COLOR = mix(tex, vec4(flash_color.rgb, tex.a), flash * tex.a);
}
