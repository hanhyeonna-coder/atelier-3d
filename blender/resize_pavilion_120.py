import bpy
import math

# ============================================================
# Atelier 3D - Pavilion Resize 120%
# Blender 5.x
#
# Goal:
# - Make pavilion footprint 1.20x wider.
# - Keep avatar / easels / stools / columns themselves the same size.
# - Move furniture + columns outward radially.
# - Expand floor / dome / circular rails / roof structure in X/Y only.
# - Keep Z height unchanged.
# - Keep exterior landscape and center decoration untouched.
#
# IMPORTANT:
# Run on the MASTER / working .blend, not on an exported GLB.
# Save a backup before running.
# ============================================================

FACTOR = 1.20

# Objects to NEVER touch.
EXCLUDE_HINTS = (
    "avatar",
    "atelieravatarrig",
    "av ",
    "av_",
    "ext ",          # exterior
    "ext_",          # exterior
    "boat",
    "village",
    "house",
    "tree",
    "shore",
    "water",
    "bridge",
    "centerpiece",
    "atelier_centerpiece",
)

# Furniture: move outward only, do not scale object size.
MOVE_ONLY_HINTS = (
    "easel",
    "stool",
)

# Structural posts: move outward only, keep thickness.
COLUMN_HINTS = (
    "column ",
    "pillar",
    "post",
)

# Upper/lower wall decor: move outward only.
DECOR_MOVE_HINTS = (
    "upper flower",
    "lower flower",
)

# Wide/radial architectural pieces: scale footprint in X/Y.
SCALE_XY_HINTS = (
    "glass dome",
    "floor",
    "platform",
    "base",
    "ring",
    "rail",
    "railing",
    "roof beam",
    "roof",
    "ceiling",
    "dome",
)

def name_l(obj):
    return (obj.name or "").lower()

def excluded(obj):
    n=name_l(obj)
    return any(h in n for h in EXCLUDE_HINTS)

def scale_location_xy(obj, factor):
    obj.location.x *= factor
    obj.location.y *= factor

def scale_object_xy(obj, factor):
    # Expand footprint only. Preserve height.
    obj.scale.x *= factor
    obj.scale.y *= factor

moved_only=[]
scaled_xy=[]
skipped=[]

for obj in bpy.context.scene.objects:
    if excluded(obj):
        skipped.append(obj.name)
        continue

    n=name_l(obj)

    # Furniture / columns / wall decor:
    # only move away from center; keep their physical size.
    if any(h in n for h in MOVE_ONLY_HINTS + COLUMN_HINTS + DECOR_MOVE_HINTS):
        scale_location_xy(obj, FACTOR)
        moved_only.append(obj.name)
        continue

    # Pavilion architectural shell.
    if any(h in n for h in SCALE_XY_HINTS):
        scale_location_xy(obj, FACTOR)
        scale_object_xy(obj, FACTOR)
        scaled_xy.append(obj.name)
        continue

# Update view layer.
bpy.context.view_layer.update()

def draw(self, context):
    self.layout.label(text="파빌리온 1.20배 확장 완료")
    self.layout.label(text=f"위치만 이동: {len(moved_only)}개")
    self.layout.label(text=f"X/Y 확장: {len(scaled_xy)}개")
    self.layout.label(text=f"제외/유지: {len(skipped)}개")
    self.layout.separator()
    self.layout.label(text="이젤/스툴/기둥 크기는 그대로 유지")
    self.layout.label(text="중앙 장식/외부 풍경/아바타는 변경하지 않음")
    self.layout.label(text="확인 후 새 이름으로 저장하세요.")

bpy.context.window_manager.popup_menu(
    draw,
    title="Atelier Pavilion 120%",
    icon='INFO'
)

print("=== Pavilion Resize 120% ===")
print("Moved only:", len(moved_only))
for n in moved_only:
    print(" MOVE", n)
print("Scaled XY:", len(scaled_xy))
for n in scaled_xy:
    print(" SCALE", n)
print("Skipped:", len(skipped))
