import bpy

# Atelier furniture selector
# Selects ONLY easels + stools for a separate GLB export.
# It also unhides the objects and their collections where possible.

KEYWORDS = ("easel", "stool")

# Unhide collections recursively.
def unhide_collection(col):
    try:
        col.hide_viewport = False
        col.hide_render = False
    except Exception:
        pass
    for child in col.children:
        unhide_collection(child)

unhide_collection(bpy.context.scene.collection)

bpy.ops.object.select_all(action='DESELECT')

selected = []
for obj in bpy.data.objects:
    name = (obj.name or "").lower()
    if any(k in name for k in KEYWORDS):
        try:
            obj.hide_set(False)
        except Exception:
            pass
        try:
            obj.hide_viewport = False
            obj.hide_render = False
        except Exception:
            pass

        # Make sure collections containing the object are visible.
        for col in obj.users_collection:
            try:
                col.hide_viewport = False
                col.hide_render = False
            except Exception:
                pass

        # Only select objects available in current view layer.
        if obj.name in bpy.context.view_layer.objects:
            try:
                obj.select_set(True)
                selected.append(obj.name)
            except Exception:
                pass

# Make one selected object active.
for obj in bpy.context.selected_objects:
    bpy.context.view_layer.objects.active = obj
    break

def draw(self, context):
    self.layout.label(text=f"이젤/스툴 선택 완료: {len(selected)}개")
    if len(selected) == 0:
        self.layout.label(text="0개면 Outliner에서 해당 컬렉션이 View Layer에서 제외된 상태입니다.")
    else:
        self.layout.label(text="이 상태에서 Selected Objects로 GLB Export")
        self.layout.label(text="파일명: atelier_furniture.glb")

bpy.context.window_manager.popup_menu(
    draw,
    title="Atelier Furniture Export",
    icon='INFO'
)
