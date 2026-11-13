import bpy

# Select boat objects + animated parents/empties for standalone export.
# Run on original/backup blend that still has boat animation.
# Export as atelier_boat.glb with Selected Objects + Animation ON.

KEYWORDS=("boat","ext boat")

bpy.ops.object.select_all(action='DESELECT')

selected=set()

def add_with_parents(obj):
    cur=obj
    while cur:
        if cur.name in bpy.context.view_layer.objects:
            try:
                cur.hide_set(False)
                cur.hide_viewport=False
                cur.hide_render=False
                cur.select_set(True)
                selected.add(cur.name)
            except Exception:
                pass
        cur=cur.parent

for obj in bpy.data.objects:
    n=(obj.name or "").lower()
    if any(k in n for k in KEYWORDS):
        add_with_parents(obj)
        # include children too
        for child in obj.children_recursive:
            if child.name in bpy.context.view_layer.objects:
                try:
                    child.hide_set(False)
                    child.hide_viewport=False
                    child.hide_render=False
                    child.select_set(True)
                    selected.add(child.name)
                except Exception:
                    pass

for obj in bpy.context.selected_objects:
    bpy.context.view_layer.objects.active=obj
    break

def draw(self, context):
    self.layout.label(text=f"배 관련 선택: {len(selected)}개")
    if selected:
        self.layout.label(text="Export: atelier_boat.glb")
        self.layout.label(text="Selected Objects ON / Animation ON")
    else:
        self.layout.label(text="0개면 Outliner에서 Boat 이름 캡처 보내주세요.")

bpy.context.window_manager.popup_menu(draw,title="Boat Export",icon='INFO')

print("=== Boat export selection ===")
for n in sorted(selected):
    print(n)
