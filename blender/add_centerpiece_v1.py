import bpy, math
from mathutils import Vector

# ============================================================
# Atelier Centerpiece v1
# Adds a decorative central art-object island to the CURRENT scene.
# Does not delete or move existing pavilion objects.
# Blender 4.0+
# ============================================================

COLL_NAME = "ATELIER_CENTERPIECE_V1"

def get_or_make_collection(name):
    c=bpy.data.collections.get(name)
    if c:
        # clear previous generated objects only
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        return c
    c=bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

COLL=get_or_make_collection(COLL_NAME)

def link_to_coll(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    COLL.objects.link(obj)
    return obj

def mat(name, color, rough=.65, metal=0.0):
    m=bpy.data.materials.get(name)
    if not m:
        m=bpy.data.materials.new(name)
        m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*color,1)
    bsdf.inputs["Roughness"].default_value=rough
    bsdf.inputs["Metallic"].default_value=metal
    return m

MAT_STONE=mat("CP Soft Limestone",(0.66,0.58,0.50),.82)
MAT_WOOD=mat("CP Warm Oak",(0.43,0.22,0.10),.52)
MAT_CREAM=mat("CP Ceramic Cream",(0.92,0.86,0.73),.38)
MAT_TERR=mat("CP Terracotta",(0.58,0.26,0.13),.72)
MAT_BRASS=mat("CP Brass",(0.62,0.36,0.11),.30,.65)
MAT_GREEN=mat("CP Leaf Green",(0.23,0.46,0.20),.80)
MAT_GREEN2=mat("CP Leaf Green 2",(0.39,0.57,0.30),.80)
MAT_PINK=mat("CP Petal Pink",(0.94,0.50,0.62),.72)
MAT_LILAC=mat("CP Petal Lilac",(0.70,0.57,0.90),.72)
MAT_PEACH=mat("CP Petal Peach",(0.98,0.68,0.43),.72)
MAT_BLUE=mat("CP Petal Blue",(0.50,0.70,0.95),.72)
MAT_YELLOW=mat("CP Petal Yellow",(0.96,0.80,0.38),.70)
MAT_BOOK1=mat("CP Book Sage",(0.33,0.44,0.31),.78)
MAT_BOOK2=mat("CP Book Rose",(0.62,0.34,0.38),.78)
MAT_BOOK3=mat("CP Book Cream",(0.75,0.67,0.52),.78)
MAT_DARK=mat("CP Dark",(0.13,0.09,0.07),.62)

FLOWER_MATS=[MAT_PINK,MAT_LILAC,MAT_PEACH,MAT_BLUE,MAT_YELLOW]

def cyl(name,r,d,loc,matl,verts=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc)
    o=link_to_coll(bpy.context.object);o.name=name;o.data.materials.append(matl);return o

def cube(name,scale,loc,matl,rot=(0,0,0),bevel=.03):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=link_to_coll(bpy.context.object);o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new("Soft bevel","BEVEL");b.width=bevel;b.segments=3
    o.data.materials.append(matl);return o

def sph(name,scale,loc,matl,rot=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc,rotation=rot)
    o=link_to_coll(bpy.context.object);o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(matl);return o

def torus(name,major,minor,loc,matl,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=64,minor_segments=14,location=loc,rotation=rot)
    o=link_to_coll(bpy.context.object);o.name=name;o.data.materials.append(matl);return o

def vase(name,loc,scale=1.0,matl=MAT_CREAM):
    # simple elegant vase from stacked cylinders/spheres
    x,y,z=loc
    cyl(name+" Base",.18*scale,.08*scale,(x,y,z+.04*scale),matl)
    sph(name+" Body",(.25*scale,.25*scale,.34*scale),(x,y,z+.30*scale),matl)
    cyl(name+" Neck",.10*scale,.28*scale,(x,y,z+.58*scale),matl)
    torus(name+" Rim",.11*scale,.018*scale,(x,y,z+.73*scale),matl)
    return Vector((x,y,z+.73*scale))

def flower_puff(name,center,scale=1.0,color_offset=0):
    x,y,z=center
    # leaves tucked behind
    for i in range(5):
        a=i/5*math.tau+.25
        leaf=sph(name+f" Leaf {i}",(.13*scale,.055*scale,.025*scale),
                 (x+math.cos(a)*.12*scale,y+math.sin(a)*.12*scale,z-.015*scale),
                 MAT_GREEN if i%2==0 else MAT_GREEN2,rot=(0,0,a))
    # flower mass, no visible stems
    for i in range(14):
        a=i/14*math.tau
        rad=(.07+.025*(i%3))*scale
        sph(name+f" Petal {i}",(.057*scale,.046*scale,.035*scale),
            (x+math.cos(a)*rad,y+math.sin(a)*rad,z+((i%4)-1.5)*.012*scale),
            FLOWER_MATS[(i+color_offset)%len(FLOWER_MATS)])
    sph(name+" Core",(.065*scale,.055*scale,.04*scale),(x,y,z),MAT_YELLOW)
    # small colored bead accents
    for i in range(5):
        a=i/5*math.tau+.38
        sph(name+f" Bead {i}",(.018*scale,)*3,
            (x+math.cos(a)*.17*scale,y+math.sin(a)*.17*scale,z+.018*(i%2)*scale),
            FLOWER_MATS[(i+2+color_offset)%len(FLOWER_MATS)])

# ------------------------------------------------------------
# 1) Three low display plinths, intentionally asymmetrical
# ------------------------------------------------------------
cyl("CP Main Plinth",1.00,.26,(0,0,.13),MAT_STONE)
cyl("CP Side Plinth A",.55,.42,(-.92,.34,.21),MAT_STONE)
cyl("CP Side Plinth B",.43,.32,(.92,-.38,.16),MAT_STONE)

# wood top inset for warmth
cyl("CP Main Wood Inset",.83,.055,(0,0,.285),MAT_WOOD)

# ------------------------------------------------------------
# 2) Vases + dense flowers
# ------------------------------------------------------------
top1=vase("CP Tall Vase",(-.35,.13,.31),1.0,MAT_CREAM)
top2=vase("CP Terracotta Vase",(.48,-.20,.31),.72,MAT_TERR)

flower_puff("CP Tall Bouquet A",(top1.x-.02,top1.y,top1.z+.08),1.15,0)
flower_puff("CP Tall Bouquet B",(top1.x+.12,top1.y+.05,top1.z+.12),.92,2)
flower_puff("CP Small Bouquet",(top2.x,top2.y,top2.z+.06),.86,1)

# extra low flower clumps integrated into centerpiece
flower_puff("CP Ground Flower L",(-.92,.34,.50),.95,3)
flower_puff("CP Ground Flower R",(.92,-.38,.40),.78,4)

# ------------------------------------------------------------
# 3) Art objects: books, brush pot, small sculpture, palette
# ------------------------------------------------------------
# books
cube("CP Book 1",(.29,.22,.035),(.25,.46,.355),MAT_BOOK1,rot=(0,0,.10))
cube("CP Book 2",(.27,.20,.035),(.25,.46,.425),MAT_BOOK2,rot=(0,0,-.05))
cube("CP Book 3",(.25,.18,.032),(.25,.46,.492),MAT_BOOK3,rot=(0,0,.06))

# brush cup
cyl("CP Brush Cup",.13,.28,(-.05,-.46,.43),MAT_TERR,32)
for i in range(7):
    a=-.25+i*.09
    x=-.05+(i-3)*.018
    y=-.46
    # wooden brush handles
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.012,depth=.56,location=(x,y,.78),rotation=(a,0,(i-3)*.10))
    o=link_to_coll(bpy.context.object);o.name=f"CP Brush {i}";o.data.materials.append(MAT_WOOD)
    # dark bristle
    sph(f"CP Bristle {i}",(.024,.024,.06),(x+.02*math.sin(a),y,.985),MAT_DARK)

# small abstract plaster bust / sculpture
cyl("CP Sculpture Pedestal",.18,.16,(-.92,.34,.50),MAT_CREAM,40)
sph("CP Sculpture Body",(.14,.10,.20),(-.92,.34,.68),MAT_CREAM)
sph("CP Sculpture Head",(.09,.085,.10),(-.92,.34,.91),MAT_CREAM)
sph("CP Sculpture Nose",(.025,.018,.035),(-.92,.255,.92),MAT_CREAM)

# palette laid on main plinth
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(.58,.26,.36))
pal=link_to_coll(bpy.context.object);pal.name="CP Palette"
pal.scale=(.22,.15,.025);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
pal.data.materials.append(MAT_WOOD)
for i,m in enumerate([MAT_PINK,MAT_BLUE,MAT_YELLOW,MAT_LILAC]):
    a=i/4*math.tau
    sph(f"CP Palette Paint {i}",(.025,.018,.008),(.58+math.cos(a)*.12,.26+math.sin(a)*.075,.39),m)

# small brass candle / accent
cyl("CP Brass Accent",.07,.20,(.70,.50,.40),MAT_BRASS,32)
sph("CP Brass Accent Top",(.08,.08,.05),(.70,.50,.52),MAT_BRASS)

# ------------------------------------------------------------
# 4) Gentle object hierarchy / notes
# ------------------------------------------------------------
for o in COLL.objects:
    o["generated_by"]="atelier_centerpiece_v1"

print("ATELIER CENTERPIECE V1 added.")
print("All generated objects are inside collection:", COLL_NAME)
print("Delete or hide that collection to remove the centerpiece.")
