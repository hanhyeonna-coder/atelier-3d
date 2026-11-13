import bpy
import hashlib
import struct

# ============================================================
# Atelier 3D - Environment Web Optimizer v1
# Blender 4.0.x
#
# Purpose:
# - Keep appearance/transforms unchanged.
# - Link ONLY truly identical mesh datablocks so repeated objects
#   (flowers, spheres, torus parts, etc.) share one mesh.
# - Skip avatar/armature objects.
# - Remove now-unused duplicate mesh datablocks.
#
# IMPORTANT:
# - Save a backup .blend before running.
# - This script does NOT decimate or change visible geometry.
# ============================================================

AVATAR_NAME_HINTS = (
    "AtelierAvatarRig",
    "Avatar",
    "AV ",
    "AV_",
)

ROUND_DIGITS = 6

def is_avatar_object(obj):
    n = obj.name or ""
    if obj.type == 'ARMATURE':
        return True
    return any(h in n for h in AVATAR_NAME_HINTS)

def qf(v):
    return round(float(v), ROUND_DIGITS)

def mesh_signature(mesh):
    """
    Conservative exact-ish signature.
    Includes:
    - vertex positions
    - polygon topology
    - polygon material indices
    - UV coordinates
    - material slot names

    If any of these differ, meshes will NOT be linked.
    """
    h = hashlib.sha1()

    h.update(mesh.name.split(".")[0].encode("utf-8", "ignore"))
    h.update(struct.pack("<III", len(mesh.vertices), len(mesh.edges), len(mesh.polygons)))

    # Vertex coordinates
    for v in mesh.vertices:
        h.update(struct.pack("<fff", qf(v.co.x), qf(v.co.y), qf(v.co.z)))

    # Polygon topology + material indices
    for p in mesh.polygons:
        h.update(struct.pack("<II", len(p.vertices), int(p.material_index)))
        for idx in p.vertices:
            h.update(struct.pack("<I", int(idx)))

    # UV layers
    h.update(struct.pack("<I", len(mesh.uv_layers)))
    for uv_layer in mesh.uv_layers:
        h.update((uv_layer.name or "").encode("utf-8", "ignore"))
        h.update(struct.pack("<I", len(uv_layer.data)))
        for uv in uv_layer.data:
            h.update(struct.pack("<ff", qf(uv.uv.x), qf(uv.uv.y)))

    # Material slots
    h.update(struct.pack("<I", len(mesh.materials)))
    for mat in mesh.materials:
        name = mat.name if mat else "<None>"
        h.update(name.encode("utf-8", "ignore"))

    return h.hexdigest()

def main():
    print("\n=== Atelier Environment Web Optimizer v1 ===")

    # Gather environment mesh objects only.
    env_objects = [
        o for o in bpy.context.scene.objects
        if o.type == 'MESH' and not is_avatar_object(o)
    ]

    print(f"Environment mesh objects: {len(env_objects)}")

    canonical_by_sig = {}
    relinked_objects = 0
    duplicate_meshes = set()

    for obj in env_objects:
        mesh = obj.data

        # Skip shape-key meshes to avoid any animation/deformation surprises.
        if mesh.shape_keys is not None:
            print(f"SKIP shape keys: {obj.name}")
            continue

        sig = mesh_signature(mesh)

        if sig not in canonical_by_sig:
            canonical_by_sig[sig] = mesh
            continue

        canonical = canonical_by_sig[sig]

        if mesh == canonical:
            continue

        # Extra conservative checks.
        if len(mesh.vertices) != len(canonical.vertices):
            continue
        if len(mesh.polygons) != len(canonical.polygons):
            continue
        if len(mesh.materials) != len(canonical.materials):
            continue

        old_mesh = mesh
        obj.data = canonical
        duplicate_meshes.add(old_mesh)
        relinked_objects += 1

    # Remove only duplicate meshes that now have zero users.
    removed_meshes = 0
    for mesh in list(duplicate_meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
            removed_meshes += 1

    unique_meshes_used = len({
        o.data.name for o in env_objects
        if o.type == 'MESH' and o.data is not None
    })

    print("--------------------------------------------")
    print(f"Objects relinked to shared meshes: {relinked_objects}")
    print(f"Unused duplicate mesh datablocks removed: {removed_meshes}")
    print(f"Unique environment meshes now in use: {unique_meshes_used}")
    print("--------------------------------------------")
    print("DONE.")
    print("Now save as a NEW .blend file, then export environment only.")
    print("Recommended filename: atelier_master_web_optimized.blend")
    print("============================================\n")

    # Show result in a Blender popup so macOS users don't need System Console.
    def draw_popup(self, context):
        self.layout.label(text=f"공유 메시로 묶인 오브젝트: {relinked_objects}")
        self.layout.label(text=f"삭제된 중복 메시: {removed_meshes}")
        self.layout.label(text=f"현재 고유 환경 메시: {unique_meshes_used}")
        self.layout.separator()
        self.layout.label(text="이제 새 이름으로 저장 후 환경만 GLB로 Export 하세요.")

    bpy.context.window_manager.popup_menu(
        draw_popup,
        title="Atelier 최적화 완료",
        icon='INFO'
    )

if __name__ == "__main__":
    import traceback

    def _popup(title, lines, icon='INFO'):
        def draw(self, context):
            for line in lines:
                self.layout.label(text=str(line)[:110])
        bpy.context.window_manager.popup_menu(draw, title=title, icon=icon)

    _popup("Atelier", ["스크립트 실행 시작됨"])

    try:
        main()
    except Exception as e:
        traceback.print_exc()
        _popup(
            "최적화 오류",
            [
                type(e).__name__,
                str(e),
                "오류 내용을 캡처해서 보내주세요."
            ],
            icon='ERROR'
        )
