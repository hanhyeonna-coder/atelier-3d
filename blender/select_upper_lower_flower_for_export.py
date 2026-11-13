import bpy

# Select exact flower decor objects for export.
# Targets object names containing:
# - "Lower Flower"
# - "Upper Flower"
# Also includes numbered duplicates like ".001".

TARGETS = ("lower flower", "upper flower")

bpy.ops.object.select_all(action='DESELECT')

selected = []

# Unhide all collections in the scene.
def unhide_collection(col):
    try:
        col.hide_viewport = False
        col.hide_render = False
    except Exception:
        pass
    for child in col.children:
        unhide_collection(child)

unhide_collection(bpy.context.scene.collection)

for obj in bpy.data.objects:
    name = (obj.name or "").lower()

    if any(t in name for t in TARGETS):
        try:
            obj.hide_set(False)
            obj.hide_viewport = False
            obj.hide_render = False
        except Exception:
            pass

        for col in obj.users_collection:
            try:
                col.hide_viewport = False
                col.hide_render = False
            except Exception:
                pass

        if obj.name in bpy.context.view_layer.objects:
            try:
                obj.select_set(True)
                selected.append(obj.name)
            except Exception:
                pass

for obj in bpy.context.selected_objects:
    bpy.context.view_layer.objects.active = obj
    break

def draw(self, context):
    self.layout.label(text=f"선택된 Upper/Lower Flower: {len(selected)}개")
    if selected:
        self.layout.label(text="Selected Objects로 Export")
        self.layout.label(text="파일명: atelier_upper_lower_flower.glb")
    else:
        self.layout.label(text="0개면 오브젝트명이 다른 겁니다.")
        self.layout.label(text="Outliner 캡처를 보내주세요.")

bpy.context.window_manager.popup_menu(
    draw,
    title="Upper / Lower Flower Export",
    icon='INFO'
)

print("Selected objects:")
for n in selected:
    print(n)
