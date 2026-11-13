import bpy

# ============================================================
# FIX ONLY: move columns / easels / stools outward by 1.20x
# Do NOT scale pavilion geometry again.
#
# Uses WORLD coordinates, so parented/grouped objects move correctly.
# For grouped stools/easels, moves only the highest matching root to avoid
# double-moving children.
# ============================================================

FACTOR = 1.20

CATEGORIES = {
    "column": ("column",),
    "easel": ("easel",),
    "stool": ("stool",),
}

def category_of(obj):
    n=(obj.name or "").lower()
    for cat,keys in CATEGORIES.items():
        if any(k in n for k in keys):
            return cat
    return None

def highest_matching_root(obj, cat):
    cur=obj
    while cur.parent:
        pcat=category_of(cur.parent)
        if pcat==cat:
            cur=cur.parent
        else:
            break
    return cur

# Collect unique roots so grouped children aren't moved twice.
roots={}
for obj in bpy.context.scene.objects:
    cat=category_of(obj)
    if not cat:
        continue
    root=highest_matching_root(obj,cat)
    roots[root.name]=(root,cat)

moved=[]

for root,cat in roots.values():
    mw=root.matrix_world.copy()
    t=mw.translation.copy()

    # Blender footprint = X/Y, Z = height.
    t.x*=FACTOR
    t.y*=FACTOR

    mw.translation=t
    root.matrix_world=mw

    moved.append((cat,root.name,round(t.x,3),round(t.y,3),round(t.z,3)))

# Popup
counts={"column":0,"easel":0,"stool":0}
for cat,*_ in moved:
    counts[cat]+=1

def draw(self, context):
    self.layout.label(text="월드 좌표 1.20배 이동 완료")
    self.layout.label(text=f"기둥: {counts['column']}개")
    self.layout.label(text=f"이젤: {counts['easel']}개")
    self.layout.label(text=f"스툴: {counts['stool']}개")
    self.layout.separator()
    self.layout.label(text="파빌리온 크기는 추가로 변경하지 않았습니다.")

bpy.context.window_manager.popup_menu(
    draw,
    title="Atelier 위치 보정 완료",
    icon='INFO'
)

print("=== WORLD MOVE FIX 1.20x ===")
for row in moved:
    print(row)
