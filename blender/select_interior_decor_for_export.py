import bpy
import math

# ============================================================
# Atelier 3D - Select interior flower/decor objects only
# Run this on the ORIGINAL/BACKUP .blend before v2 optimization.
#
# Selects likely interior decorative flowers / hanging decor:
# - excludes exterior landscape collection
# - excludes easels, stools, avatar
# - selects objects with flower/leaf/blossom/petal/decor hints
# - prefers objects inside pavilion radius or above wall/ceiling height
#
# Export result as: atelier_interior_decor.glb
# ============================================================

EXTERIOR_COLLECTION_HINTS = (
    "ATELIER_EXTERIOR_V1",
    "EXTERIOR",
    "Exterior",
    "Landscape",
    "LANDSCAPE",
)

DECOR_HINTS = (
    "flower", "leaf", "blossom", "petal", "decor", "garland",
    "vine", "floral", "bouquet"
)

PROTECT_HINTS = (
    "easel", "stool", "avatar", "av ", "av_", "atelieravatarrig"
)

PAVILION_RADIUS = 7.0
MIN_HIGH_DECOR_Z = 1.4

def in_exterior_collection(obj):
    for c in obj.users_collection:
        name = c.name or ""
        if any(h in name for h in EXTERIOR_COLLECTION_HINTS):
            return True
    return False

def is_protected(obj):
    n=(obj.name or "").lower()
    return any(h in n for h in PROTECT_HINTS) or obj.type=='ARMATURE'

bpy.ops.object.select_all(action='DESELECT')

selected=[]
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    if is_protected(obj):
        continue
    if in_exterior_collection(obj):
        continue

    n=(obj.name or "").lower()
    if not any(h in n for h in DECOR_HINTS):
        continue

    # Blender scene is Z-up.
    x,y,z = obj.matrix_world.translation
    r = math.hypot(x,y)

    # Interior decor only: within pavilion radius.
    if r > PAVILION_RADIUS:
        continue

    try:
        obj.hide_set(False)
        obj.hide_viewport=False
        obj.hide_render=False
    except Exception:
        pass

    if obj.name in bpy.context.view_layer.objects:
        try:
            obj.select_set(True)
            selected.append((obj.name, round(r,2), round(z,2)))
        except Exception:
            pass

for obj in bpy.context.selected_objects:
    bpy.context.view_layer.objects.active=obj
    break

def draw(self, context):
    self.layout.label(text=f"실내 장식 선택: {len(selected)}개")
    if len(selected)==0:
        self.layout.label(text="0개면 장식 이름이 다른 경우입니다. 캡처를 보내주세요.")
    else:
        self.layout.label(text="원본/백업 파일에서 실행한 것이 맞는지 확인")
        self.layout.label(text="Selected Objects로 atelier_interior_decor.glb Export")

bpy.context.window_manager.popup_menu(
    draw,
    title="Interior Decor Export",
    icon='INFO'
)

print("=== Selected interior decor ===")
for row in selected:
    print(row)
