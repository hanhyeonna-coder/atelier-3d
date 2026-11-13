import bpy

# ============================================================
# Atelier 3D - Environment Web Optimizer v2
# Blender 5.x compatible
#
# Goal:
# - KEEP interior easels, stools, centerpiece/indoor flower decor untouched.
# - Reduce only exterior/distant decorative geometry.
# - Do not touch avatar or armature.
# - Apply conservative Decimate ratios to exterior-only objects.
#
# Run on a BACKUP / optimized copy.
# ============================================================

EXTERIOR_COLLECTION_HINTS = (
    "ATELIER_EXTERIOR_V1",
    "EXTERIOR",
    "Exterior",
    "Landscape",
    "LANDSCAPE",
)

# Objects whose names suggest distant/detail-heavy exterior content.
EXTERIOR_NAME_HINTS = (
    "EXT ",
    "EXT_",
    "Tree",
    "TREE",
    "Flower",
    "FLOWER",
    "Village",
    "House",
    "Building",
    "Bridge",
    "Boat",
    "Shore",
    "Water",
)

# Never touch these.
PROTECT_NAME_HINTS = (
    "Easel",
    "Stool",
    "ATELIER_CENTERPIECE",
    "Centerpiece",
    "AV ",
    "AV_",
    "Avatar",
    "AtelierAvatarRig",
)

def protected(obj):
    n = obj.name or ""
    if obj.type == 'ARMATURE':
        return True
    return any(h in n for h in PROTECT_NAME_HINTS)

def in_exterior_collection(obj):
    for c in obj.users_collection:
        if any(h in c.name for h in EXTERIOR_COLLECTION_HINTS):
            return True
    return False

def looks_exterior(obj):
    n = obj.name or ""
    return in_exterior_collection(obj) or any(h in n for h in EXTERIOR_NAME_HINTS)

def target_ratio(obj):
    n = obj.name or ""

    # Stronger reduction on repeated vegetation / tiny details.
    if any(k in n for k in ("Flower","FLOWER","Tree","TREE","Leaf","LEAF")):
        return 0.35

    # Moderate reduction on distant buildings / landscape props.
    if any(k in n for k in ("Village","House","Building","Bridge","Shore")):
        return 0.55

    # Boats/water generally need less reduction.
    if any(k in n for k in ("Boat","Water")):
        return 0.75

    return 0.60

changed = 0
skipped = 0
before_faces = 0
after_faces_est = 0

for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    if protected(obj):
        skipped += 1
        continue
    if not looks_exterior(obj):
        continue
    if obj.data.shape_keys is not None:
        skipped += 1
        continue

    faces = len(obj.data.polygons)
    if faces < 80:
        continue

    ratio = target_ratio(obj)
    before_faces += faces
    after_faces_est += int(faces * ratio)

    # Avoid stacking duplicate decimate modifiers if script is run twice.
    old = obj.modifiers.get("ATELIER_WEB_DECIMATE")
    if old:
        obj.modifiers.remove(old)

    mod = obj.modifiers.new(name="ATELIER_WEB_DECIMATE", type='DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = ratio
    mod.use_collapse_triangulate = False

    # Apply modifier
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
        changed += 1
    except Exception:
        obj.select_set(False)
        skipped += 1
        continue
    obj.select_set(False)

def draw(self, context):
    self.layout.label(text=f"외부 최적화 완료: {changed}개 오브젝트")
    self.layout.label(text=f"보호/건너뜀: {skipped}개")
    self.layout.label(text=f"대상 면 수: {before_faces:,}")
    self.layout.label(text=f"예상 최적화 후 면 수: {after_faces_est:,}")
    self.layout.separator()
    self.layout.label(text="이젤 / 스툴 / 실내 중심장식 / 아바타는 건드리지 않음")
    self.layout.label(text="새 이름으로 저장 후 환경 전체 선택 Export")

bpy.context.window_manager.popup_menu(
    draw,
    title="Atelier 2차 웹 최적화 완료",
    icon='INFO'
)
