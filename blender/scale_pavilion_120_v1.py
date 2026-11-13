import bpy
import math

# ============================================================
# Atelier 3D - Pavilion 1.20x Expansion
# Blender 5.x compatible
#
# Expands the pavilion footprint by 20% while preserving:
# - avatar
# - exterior landscape / water / boats / village
# - centerpiece size
#
# Strategy:
# - floor / dome / rings / roof beams: scale X/Y by 1.20
# - columns / easels / stools: move radially outward by 1.20
# - centerpiece: unchanged
#
# IMPORTANT:
# Save a backup .blend before running.
# ============================================================

FACTOR = 1.20

EXTERIOR_COLLECTION_HINTS = (
    "ATELIER_EXTERIOR_V1",
    "EXTERIOR",
    "Exterior",
    "Landscape",
    "LANDSCAPE",
)

AVATAR_HINTS = (
    "AtelierAvatarRig",
    "Avatar",
    "AV ",
    "AV_",
)

CENTERPIECE_HINTS = (
    "ATELIER_CENTERPIECE",
    "Centerpiece",
    "centerpiece",
)

# Objects whose actual geometry should widen.
SCALE_GEOMETRY_HINTS = (
    "floor",
    "base",
    "platform",
    "glass dome",
    "dome",
    "ring",
    "rail",
    "railing",
    "roof beam",
    "roofbeam",
    "roof_",
)

# Objects that should keep their size but move outward.
MOVE_ONLY_HINTS = (
    "column",
    "easel",
    "stool",
)

def in_exterior_collection(obj):
    for col in obj.users_collection:
        name = col.name or ""
        if any(h in name for h in EXTERIOR_COLLECTION_HINTS):
            return True
    return False

def is_avatar(obj):
    n = obj.name or ""
    if obj.type == 'ARMATURE':
        return True
    return any(h in n for h in AVATAR_HINTS)

def is_centerpiece(obj):
    n = obj.name or ""
    if any(h.lower() in n.lower() for h in CENTERPIECE_HINTS):
        return True
    for col in obj.users_collection:
        if any(h.lower() in (col.name or "").lower() for h in CENTERPIECE_HINTS):
            return True
    return False

def radial_move(obj, factor):
    # Blender is Z-up, pavilion footprint is X/Y.
    obj.location.x *= factor
    obj.location.y *= factor

def scale_xy(obj, factor):
    # Preserve height (Z), enlarge only the pavilion footprint.
    obj.scale.x *= factor
    obj.scale.y *= factor

changed_scaled = []
changed_moved = []
skipped = []

for obj in bpy.context.scene.objects:
    if is_avatar(obj) or in_exterior_collection(obj) or is_centerpiece(obj):
        skipped.append(obj.name)
        continue

    n = (obj.name or "").lower()

    if any(h in n for h in SCALE_GEOMETRY_HINTS):
        scale_xy(obj, FACTOR)
        changed_scaled.append(obj.name)
        continue

    if any(h in n for h in MOVE_ONLY_HINTS):
        radial_move(obj, FACTOR)
        changed_moved.append(obj.name)
        continue

# Popup summary
def draw(self, context):
    self.layout.label(text=f"파빌리온 1.20배 확장 완료")
    self.layout.label(text=f"가로폭 확장: {len(changed_scaled)}개")
    self.layout.label(text=f"바깥쪽 이동: {len(changed_moved)}개")
    self.layout.separator()
    self.layout.label(text="외부 풍경 / 아바타 / 중앙장식은 유지")
    self.layout.label(text="화면 확인 후 새 이름으로 저장하세요.")

bpy.context.window_manager.popup_menu(
    draw,
    title="Atelier Pavilion 1.20x",
    icon='INFO'
)

print("=== Pavilion 1.20x ===")
print("Scaled geometry:", len(changed_scaled))
for n in changed_scaled:
    print(" SCALE:", n)

print("Moved outward:", len(changed_moved))
for n in changed_moved:
    print(" MOVE:", n)

print("Skipped:", len(skipped))
