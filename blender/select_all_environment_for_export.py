import bpy

AVATAR_HINTS = (
    "AtelierAvatarRig",
    "Avatar",
    "AV ",
    "AV_",
)

def is_avatar(obj):
    n = obj.name or ""
    if obj.type == 'ARMATURE':
        return True
    return any(h in n for h in AVATAR_HINTS)

# Deselect everything first
bpy.ops.object.select_all(action='DESELECT')

selected = 0
skipped = 0

for obj in bpy.context.scene.objects:
    if is_avatar(obj):
        obj.select_set(False)
        skipped += 1
        continue

    # Include all environment objects, including easels, stools,
    # centerpiece flowers, exterior, boats, etc.
    if obj.type in {'MESH','EMPTY','CURVE','SURFACE','FONT','META','LIGHT','CAMERA'}:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
        selected += 1

def draw(self, context):
    self.layout.label(text=f"환경 선택 완료: {selected}개")
    self.layout.label(text=f"아바타/리그 제외: {skipped}개")
    self.layout.separator()
    self.layout.label(text="이 상태에서 glTF Export > Selected Objects 체크")

bpy.context.window_manager.popup_menu(
    draw,
    title="환경 Export 선택 완료",
    icon='INFO'
)
