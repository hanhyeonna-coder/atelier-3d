import bpy, math
from mathutils import Vector

# ============================================================
# ATELIER AVATAR V1
# Stylized artist avatar with:
# - beret + center nub
# - rounded apron + pocket + rear waist ties
# - palette + pencil
# - simple rig
# - Idle / Walk / Sit / Paint actions
# Blender 4.0+
# ============================================================

COLL_NAME = "ATELIER_AVATAR_V1"
ARM_NAME = "AtelierAvatarRig"

# ------------------------------------------------------------
# collection
# ------------------------------------------------------------
def get_or_make_collection(name):
    c=bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        return c
    c=bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

COLL=get_or_make_collection(COLL_NAME)

def relink(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COLL.objects.link(o)
    return o

# ------------------------------------------------------------
# materials
# ------------------------------------------------------------
def mat(name,color,rough=.7,metal=0.0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*color,1)
    bsdf.inputs["Roughness"].default_value=rough
    bsdf.inputs["Metallic"].default_value=metal
    return m

SKIN=mat("AV Skin",(0.82,0.60,0.47),.72)
HAIR=mat("AV Hair",(0.16,0.08,0.05),.90)
SHIRT=mat("AV Shirt",(0.86,0.79,0.68),.84)
PANTS=mat("AV Pants",(0.18,0.20,0.23),.90)
SHOE=mat("AV Shoes",(0.10,0.08,0.07),.82)
APRON=mat("AV Apron",(0.63,0.48,0.35),.86)
BERET=mat("AV Beret",(0.55,0.16,0.16),.80)
WOOD=mat("AV Wood",(0.48,0.26,0.11),.72)
BRASS=mat("AV Brass",(0.63,0.38,0.13),.36,.55)
PAINTS=[
    mat("AV Paint Red",(0.72,0.18,0.14),.68),
    mat("AV Paint Blue",(0.15,0.40,0.70),.68),
    mat("AV Paint Yellow",(0.92,0.70,0.16),.68),
    mat("AV Paint Green",(0.24,0.55,0.28),.68),
]
PENCIL_YELLOW=mat("AV Pencil Yellow",(0.91,0.62,0.12),.60)
GRAPHITE=mat("AV Graphite",(0.07,0.07,0.07),.58)
ERASER=mat("AV Eraser",(0.75,0.28,0.28),.72)

# ------------------------------------------------------------
# primitives
# ------------------------------------------------------------
def cube(name,scale,loc,material,rot=(0,0,0),bevel=.0):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=relink(bpy.context.object);o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new("Soft Bevel","BEVEL");b.width=bevel;b.segments=3
    o.data.materials.append(material)
    return o

def cyl(name,r,d,loc,material,rot=(0,0,0),verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc,rotation=rot)
    o=relink(bpy.context.object);o.name=name;o.data.materials.append(material);return o

def sph(name,scale,loc,material,rot=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc,rotation=rot)
    o=relink(bpy.context.object);o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material);return o

def cone(name,r1,r2,d,loc,material,rot=(0,0,0),verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=d,location=loc,rotation=rot)
    o=relink(bpy.context.object);o.name=name;o.data.materials.append(material);return o

# ------------------------------------------------------------
# armature
# ------------------------------------------------------------
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
rig=relink(bpy.context.object)
rig.name=ARM_NAME
rig.data.name=ARM_NAME

edit=rig.data.edit_bones
root=edit[0]
root.name="root"
root.head=(0,0,0)
root.tail=(0,0,0.35)

def eb(name,head,tail,parent=None,connected=False):
    b=edit.new(name)
    b.head=head;b.tail=tail
    b.parent=parent;b.use_connect=connected
    return b

hips=eb("hips",(0,0,.55),(0,0,.86),root)
spine=eb("spine",(0,0,.86),(0,0,1.22),hips,True)
neck=eb("neck",(0,0,1.22),(0,0,1.36),spine,True)
head_b=eb("head",(0,0,1.36),(0,0,1.62),neck,True)

ua_l=eb("upper_arm.L",(-.13,0,1.16),(-.43,0,1.04),spine)
fa_l=eb("forearm.L",(-.43,0,1.04),(-.66,0,.86),ua_l,True)
hand_l=eb("hand.L",(-.66,0,.86),(-.72,0,.80),fa_l,True)

ua_r=eb("upper_arm.R",(.13,0,1.16),(.43,0,1.04),spine)
fa_r=eb("forearm.R",(.43,0,1.04),(.66,0,.86),ua_r,True)
hand_r=eb("hand.R",(.66,0,.86),(.72,0,.80),fa_r,True)

th_l=eb("thigh.L",(-.13,0,.62),(-.13,0,.30),hips)
sh_l=eb("shin.L",(-.13,0,.30),(-.13,0,.06),th_l,True)
foot_l=eb("foot.L",(-.13,0,.06),(-.13,-.18,.04),sh_l,True)

th_r=eb("thigh.R",(.13,0,.62),(.13,0,.30),hips)
sh_r=eb("shin.R",(.13,0,.30),(.13,0,.06),th_r,True)
foot_r=eb("foot.R",(.13,0,.06),(.13,-.18,.04),sh_r,True)

bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True

# ------------------------------------------------------------
# rigid-part parenting helpers
# ------------------------------------------------------------
def bone_parent(obj,bone_name):
    obj.parent=rig
    obj.parent_type='BONE'
    obj.parent_bone=bone_name
    return obj

# torso
bone_parent(cyl("AV Torso",.24,.56,(0,0,.97),SHIRT,verts=28),"spine")
# hips
bone_parent(sph("AV Hips",(.29,.20,.22),(0,0,.67),PANTS),"hips")

# head / hair
bone_parent(sph("AV Head",(.25,.23,.27),(0,-.005,1.48),SKIN),"head")
bone_parent(sph("AV Hair Cap",(.265,.24,.20),(0,.02,1.57),HAIR),"head")
# small side hair locks
bone_parent(sph("AV Hair L",(.07,.05,.17),(-.20,.02,1.43),HAIR,rot=(0,0,.16)),"head")
bone_parent(sph("AV Hair R",(.07,.05,.17),(.20,.02,1.43),HAIR,rot=(0,0,-.16)),"head")

# nose
bone_parent(cone("AV Nose",.035,0,.10,(0,-.235,1.47),SKIN,rot=(math.radians(90),0,0),verts=16),"head")

# beret main
beret=sph("AV Beret",(.31,.28,.065),(0,.02,1.73),BERET,rot=(0,0,-.10))
bone_parent(beret,"head")
# centered nub
nub=cyl("AV Beret Nub",.024,.075,(0,.02,1.82),BERET,verts=16)
bone_parent(nub,"head")

# arms
for side,x in (("L",-1),("R",1)):
    bone_parent(cyl(f"AV UpperArm {side}",.065,.32,(.28*x,0,1.08),SHIRT,rot=(0,0,math.radians(66*x))),f"upper_arm.{side}")
    bone_parent(cyl(f"AV Forearm {side}",.058,.30,(.55*x,0,.94),SKIN,rot=(0,0,math.radians(52*x))),f"forearm.{side}")
    bone_parent(sph(f"AV Hand {side}",(.075,.06,.075),(.70*x,0,.82),SKIN),f"hand.{side}")

# legs
for side,x in (("L",-1),("R",1)):
    bone_parent(cyl(f"AV Thigh {side}",.082,.34,(.13*x,0,.43),PANTS),f"thigh.{side}")
    bone_parent(cyl(f"AV Shin {side}",.072,.28,(.13*x,0,.17),PANTS),f"shin.{side}")
    bone_parent(sph(f"AV Shoe {side}",(.10,.17,.065),(.13*x,-.10,.035),SHOE),f"foot.{side}")

# ------------------------------------------------------------
# rounded apron
# ------------------------------------------------------------
# bib
bib=sph("AV Apron Bib",(.19,.055,.24),(0,-.22,1.04),APRON)
bone_parent(bib,"spine")

# rounded lower apron body
apron=sph("AV Apron Body",(.31,.055,.34),(0,-.225,.76),APRON)
bone_parent(apron,"hips")

# pocket
pocket=sph("AV Apron Pocket",(.14,.035,.105),(0,-.278,.72),APRON)
bone_parent(pocket,"hips")

# shoulder straps
strap_l=cube("AV Apron Strap L",(.025,.018,.26),(-.13,-.205,1.20),APRON,rot=(0,math.radians(-10),0),bevel=.01)
strap_r=cube("AV Apron Strap R",(.025,.018,.26),(.13,-.205,1.20),APRON,rot=(0,math.radians(10),0),bevel=.01)
bone_parent(strap_l,"spine");bone_parent(strap_r,"spine")

# waist belt / rear ties
belt=cube("AV Apron Belt",(.31,.025,.025),(0,.0,.83),APRON,bevel=.012)
bone_parent(belt,"hips")
tie_l=cube("AV Apron Rear Tie L",(.20,.022,.018),(-.28,.08,.82),APRON,rot=(0,0,math.radians(23)),bevel=.008)
tie_r=cube("AV Apron Rear Tie R",(.20,.022,.018),(.28,.08,.82),APRON,rot=(0,0,math.radians(-23)),bevel=.008)
bone_parent(tie_l,"hips");bone_parent(tie_r,"hips")
knot=sph("AV Apron Knot",(.045,.035,.045),(0,.10,.82),APRON)
bone_parent(knot,"hips")

# ------------------------------------------------------------
# palette + pencil
# ------------------------------------------------------------
# palette in left hand
palette=sph("AV Palette",(.20,.035,.14),(-.74,-.03,.78),WOOD,rot=(0,math.radians(10),math.radians(-10)))
bone_parent(palette,"hand.L")
for i,m in enumerate(PAINTS):
    a=i/4*math.tau
    p=sph(f"AV Palette Paint {i}",(.027,.012,.020),(-.74+math.cos(a)*.10,-.066,.78+math.sin(a)*.065),m)
    bone_parent(p,"hand.L")

# thumb hole simulated with dark inset ring
hole=sph("AV Palette Thumb Hole",(.045,.010,.035),(-.67,-.071,.82),HAIR)
bone_parent(hole,"hand.L")

# pencil right hand
shaft=cyl("AV Pencil Shaft",.018,.36,(.73,-.02,.70),PENCIL_YELLOW,rot=(math.radians(15),0,math.radians(12)),verts=6)
bone_parent(shaft,"hand.R")
wood_tip=cone("AV Pencil Wood",.025,0,.09,(.76,-.03,.52),WOOD,rot=(math.radians(15),0,math.radians(12)),verts=12)
bone_parent(wood_tip,"hand.R")
lead=cone("AV Pencil Lead",.012,0,.035,(.77,-.035,.47),GRAPHITE,rot=(math.radians(15),0,math.radians(12)),verts=10)
bone_parent(lead,"hand.R")
eraser=cyl("AV Pencil Eraser",.021,.045,(.70,-.01,.88),ERASER,rot=(math.radians(15),0,math.radians(12)),verts=12)
bone_parent(eraser,"hand.R")

# ------------------------------------------------------------
# animation helpers
# ------------------------------------------------------------
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='POSE')

def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_mode='XYZ'
        pb.rotation_euler=(0,0,0)
        pb.location=(0,0,0)

def set_action(name):
    act=bpy.data.actions.get(name) or bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action=act
    return act

def key(bone,frame,rot=None,loc=None):
    pb=rig.pose.bones[bone]
    if rot is not None:
        pb.rotation_mode='XYZ'
        pb.rotation_euler=rot
        pb.keyframe_insert(data_path="rotation_euler",frame=frame)
    if loc is not None:
        pb.location=loc
        pb.keyframe_insert(data_path="location",frame=frame)

# IDLE
reset_pose()
set_action("Avatar_Idle")
for f in (1,20,40):
    key("spine",f,rot=(math.radians(2 if f==20 else 0),0,0))
    key("head",f,rot=(0,math.radians(2 if f==20 else -1 if f==40 else 0),0))

# WALK
reset_pose()
set_action("Avatar_Walk")
for f,sgn in ((1,1),(7,-1),(13,1)):
    key("thigh.L",f,rot=(math.radians(28*sgn),0,0))
    key("thigh.R",f,rot=(math.radians(-28*sgn),0,0))
    key("shin.L",f,rot=(math.radians(-18 if sgn>0 else 8),0,0))
    key("shin.R",f,rot=(math.radians(8 if sgn>0 else -18),0,0))
    key("upper_arm.L",f,rot=(math.radians(-18*sgn),0,0))
    key("upper_arm.R",f,rot=(math.radians(18*sgn),0,0))

# SIT
reset_pose()
set_action("Avatar_Sit")
key("hips",1,loc=(0,0,-.16))
key("hips",20,loc=(0,0,-.16))
for b in ("thigh.L","thigh.R"):
    key(b,1,rot=(math.radians(-72),0,0))
    key(b,20,rot=(math.radians(-72),0,0))
for b in ("shin.L","shin.R"):
    key(b,1,rot=(math.radians(78),0,0))
    key(b,20,rot=(math.radians(78),0,0))

# PAINT
reset_pose()
set_action("Avatar_Paint")
key("hips",1,loc=(0,0,-.16))
key("hips",32,loc=(0,0,-.16))
for b in ("thigh.L","thigh.R"):
    key(b,1,rot=(math.radians(-72),0,0))
    key(b,32,rot=(math.radians(-72),0,0))
for b in ("shin.L","shin.R"):
    key(b,1,rot=(math.radians(78),0,0))
    key(b,32,rot=(math.radians(78),0,0))

# left arm holding palette
for f in (1,32):
    key("upper_arm.L",f,rot=(math.radians(-18),math.radians(-8),math.radians(-28)))
    key("forearm.L",f,rot=(math.radians(-34),0,math.radians(-12)))

# right arm painting loop
for f,rx,rz in ((1,-34,20),(8,-58,8),(16,-38,28),(24,-54,5),(32,-34,20)):
    key("upper_arm.R",f,rot=(math.radians(rx),0,math.radians(rz)))
    key("forearm.R",f,rot=(math.radians(-42),0,math.radians(-10)))
    key("hand.R",f,rot=(math.radians(6),math.radians(8),math.radians(-5)))

key("head",1,rot=(math.radians(-5),0,0))
key("head",16,rot=(math.radians(-8),math.radians(4),0))
key("head",32,rot=(math.radians(-5),0,0))

# Blender version-safe: keep default keyframe interpolation.
# (Direct Action.fcurves access is unavailable in some Blender versions.)

# default to Idle
rig.animation_data.action=bpy.data.actions.get("Avatar_Idle")
bpy.context.scene.frame_start=1
bpy.context.scene.frame_end=40

bpy.ops.object.mode_set(mode='OBJECT')

# place avatar near origin but slightly forward so it is easy to inspect
rig.location=(0,-2.2,0)

for o in COLL.objects:
    o["generated_by"]="atelier_avatar_v1"

print("ATELIER AVATAR V1 created.")
print("Collection:",COLL_NAME)
print("Rig:",ARM_NAME)
print("Actions: Avatar_Idle / Avatar_Walk / Avatar_Sit / Avatar_Paint")
