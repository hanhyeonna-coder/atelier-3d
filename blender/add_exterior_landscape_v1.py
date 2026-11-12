import bpy, math
from mathutils import Vector

# ============================================================
# ATELIER EXTERIOR LANDSCAPE V1
# Adds exterior scenery around the CURRENT pavilion scene.
# Existing interior objects are not deleted or moved.
# Blender 4.0+
# ============================================================

COLL_NAME = "ATELIER_EXTERIOR_V1"

# ---------- TUNING ----------
CENTER = (0.0, 0.0, 0.0)
PAVILION_RADIUS = 10.5
WATER_INNER_RADIUS = 11.1
WATER_OUTER_RADIUS = 34.0
SHORE_RADIUS = 31.0
VILLAGE_RADIUS = 27.0
VILLAGE_Z = 0.45
TREE_RADIUS = 23.5
BRIDGE_ANGLE_DEG = 25.0
BOAT_COUNT = 3
BOAT_SPEEDS = [240, 320, 400]   # frames per loop
START_FRAME = 1

# ---------- collection ----------
def get_or_make_collection(name):
    c = bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        return c
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

COLL = get_or_make_collection(COLL_NAME)

def relink(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COLL.objects.link(o)
    return o

# ---------- materials ----------
def mat(name, color, rough=.6, metal=0.0, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["Alpha"].default_value = alpha
    return m

WATER_M = mat("EXT Water", (0.10,0.40,0.56), .16, .08, .12, .92)
BANK_M  = mat("EXT Bank",  (0.38,0.46,0.24), .86)
SOIL_M  = mat("EXT Soil",  (0.30,0.20,0.11), .92)
WOOD_M  = mat("EXT Wood",  (0.43,0.24,0.11), .58)
WOOD_D  = mat("EXT Dark Wood",(0.20,0.10,0.05),.65)
STONE_M = mat("EXT Stone", (0.66,0.61,0.54), .82)
ROOF_R  = mat("EXT Roof Red",(0.56,0.18,0.11),.72)
ROOF_B  = mat("EXT Roof Blue",(0.20,0.36,0.50),.72)
ROOF_G  = mat("EXT Roof Green",(0.22,0.42,0.28),.72)
WALL_C  = mat("EXT Wall Cream",(0.84,0.76,0.62),.82)
WALL_P  = mat("EXT Wall Peach",(0.82,0.57,0.44),.82)
WALL_Y  = mat("EXT Wall Yellow",(0.84,0.72,0.41),.82)
GREEN_1 = mat("EXT Leaf 1",(0.20,0.43,0.18),.88)
GREEN_2 = mat("EXT Leaf 2",(0.34,0.56,0.26),.88)
GREEN_3 = mat("EXT Leaf 3",(0.52,0.64,0.25),.88)
FLOW_P  = mat("EXT Flower Pink",(0.95,0.50,0.64),.72)
FLOW_L  = mat("EXT Flower Lilac",(0.72,0.58,0.94),.72)
FLOW_Y  = mat("EXT Flower Yellow",(0.98,0.78,0.30),.72)
FLOW_B  = mat("EXT Flower Blue",(0.48,0.70,0.95),.72)
WHITE_M = mat("EXT Boat White",(0.92,0.90,0.84),.58)
BLUE_M  = mat("EXT Boat Blue",(0.18,0.42,0.60),.58)
RED_M   = mat("EXT Boat Red",(0.64,0.20,0.15),.58)

# ---------- primitives ----------
def cube(name, scale, loc, material, rot=(0,0,0), bevel=.0):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = relink(bpy.context.object); o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b=o.modifiers.new("Soft Bevel","BEVEL"); b.width=bevel; b.segments=3
    o.data.materials.append(material)
    return o

def cyl(name,r,d,loc,material,verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc)
    o=relink(bpy.context.object); o.name=name; o.data.materials.append(material); return o

def sph(name,scale,loc,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc)
    o=relink(bpy.context.object); o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material); return o

def cone(name,r1,r2,d,loc,material,rot=(0,0,0),verts=32):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=d,location=loc,rotation=rot)
    o=relink(bpy.context.object);o.name=name;o.data.materials.append(material);return o

# ---------- annulus mesh ----------
def annulus(name, inner_r, outer_r, z, material, segments=160):
    verts=[]; faces=[]
    for i in range(segments):
        a=i/segments*math.tau
        verts += [(math.sin(a)*inner_r, math.cos(a)*inner_r, z),
                  (math.sin(a)*outer_r, math.cos(a)*outer_r, z)]
    for i in range(segments):
        n=(i+1)%segments
        faces.append((2*i,2*n,2*n+1,2*i+1))
    me=bpy.data.meshes.new(name+" Mesh")
    me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); COLL.objects.link(o); o.data.materials.append(material)
    return o

# ---------- water ----------
water=annulus("EXT Water Surface",WATER_INNER_RADIUS,WATER_OUTER_RADIUS,-0.55,WATER_M)
# subtle displaced ripples
tex=bpy.data.textures.get("EXT Water Noise") or bpy.data.textures.new("EXT Water Noise",type='CLOUDS')
tex.noise_scale=1.8
disp=water.modifiers.new("Tiny Water Ripples","DISPLACE")
disp.texture=tex; disp.strength=.07; disp.texture_coords='GLOBAL'

# ---------- distant shore rings ----------
annulus("EXT Green Shore",WATER_OUTER_RADIUS-2.7,WATER_OUTER_RADIUS+.8,-0.62,BANK_M)
annulus("EXT Soil Shore",WATER_OUTER_RADIUS+.6,WATER_OUTER_RADIUS+2.0,-0.64,SOIL_M)

# ---------- trees ----------
def add_tree(idx,x,y,z=0,scale=1.0):
    trunk=cyl(f"EXT Tree {idx} Trunk",.16*scale,2.2*scale,(x,y,z+1.1*scale),WOOD_D,18)
    crowns=[
        (0,0,2.25,.95, GREEN_1),
        (.45,.05,2.15,.72,GREEN_2),
        (-.38,.15,2.10,.70,GREEN_3),
        (.12,-.38,2.32,.66,GREEN_2)
    ]
    for j,(dx,dy,dz,s,m) in enumerate(crowns):
        sph(f"EXT Tree {idx} Crown {j}",(s*scale,s*.82*scale,s*.72*scale),(x+dx*scale,y+dy*scale,z+dz*scale),m)

for i in range(36):
    a=i/36*math.tau + .04*math.sin(i*1.7)
    r=TREE_RADIUS + (i%4)*1.0
    add_tree(i, math.sin(a)*r, math.cos(a)*r, -.55, .85 + .16*(i%3))

# ---------- modular village ----------
def add_house(idx, angle, radius, width=1.8, depth=1.5, height=1.55, wall=None, roof=None):
    wall=wall or [WALL_C,WALL_P,WALL_Y][idx%3]
    roof=roof or [ROOF_R,ROOF_B,ROOF_G][idx%3]
    x,y=math.sin(angle)*radius,math.cos(angle)*radius
    rz=-angle
    cube(f"EXT House {idx} Body",(width/2,depth/2,height/2),(x,y,VILLAGE_Z+height/2),wall,rot=(0,0,rz),bevel=.06)
    cone(f"EXT House {idx} Roof",max(width,depth)*.78,0,1.0,(x,y,VILLAGE_Z+height+.5),roof,rot=(0,0,rz),verts=4)
    # windows facing pavilion
    wx=x-math.sin(angle)*(depth/2+.02)
    wy=y-math.cos(angle)*(depth/2+.02)
    for k,sx in enumerate((-.42,.42)):
        # offset along tangent
        tx=math.cos(angle)*sx*width*.72
        ty=-math.sin(angle)*sx*width*.72
        cube(f"EXT House {idx} Window {k}",(.18,.025,.25),(wx+tx,wy+ty,VILLAGE_Z+.93),BLUE_M,rot=(0,0,rz),bevel=.02)

for i in range(22):
    a=i/22*math.tau
    r=VILLAGE_RADIUS + (1.0 if i%2 else 0)
    add_house(i,a,r,1.45+.18*(i%4),1.25+.12*(i%3),1.35+.18*(i%3))

# a few taller landmarks
for i,a in enumerate((.45,2.25,4.65)):
    x,y=math.sin(a)*(VILLAGE_RADIUS+.8),math.cos(a)*(VILLAGE_RADIUS+.8)
    cyl(f"EXT Tower {i}",.62,3.5,(x,y,1.20),WALL_C,32)
    cone(f"EXT Tower {i} Roof",.82,0,1.3,(x,y,3.55),ROOF_R,verts=8)

# ---------- stone bridge ----------
bridge_a=math.radians(BRIDGE_ANGLE_DEG)
bx,by=math.sin(bridge_a)*19.0,math.cos(bridge_a)*19.0
cube("EXT Bridge Deck",(3.8,.75,.18),(bx,by,-.05),STONE_M,rot=(0,0,-bridge_a),bevel=.10)
for s in (-1,1):
    # parapets
    px=bx+math.cos(bridge_a)*s*.67
    py=by-math.sin(bridge_a)*s*.67
    cube(f"EXT Bridge Rail {s}",(3.8,.08,.22),(px,py,.30),STONE_M,rot=(0,0,-bridge_a),bevel=.06)

# ---------- foreground flowers near pavilion exterior ----------
def flower_cluster(name,x,y,z,scale=1.0,offset=0):
    mats=[FLOW_P,FLOW_L,FLOW_Y,FLOW_B]
    for i in range(5):
        a=i/5*math.tau
        leaf=sph(name+f" Leaf {i}",(.18*scale,.07*scale,.035*scale),(x+math.cos(a)*.14*scale,y+math.sin(a)*.14*scale,z),GREEN_2)
        leaf.rotation_euler[2]=a
    for i in range(12):
        a=i/12*math.tau
        rad=(.08+.025*(i%3))*scale
        sph(name+f" Flower {i}",(.06*scale,.05*scale,.035*scale),(x+math.cos(a)*rad,y+math.sin(a)*rad,z+.05*scale),mats[(i+offset)%4])

for i in range(18):
    a=i/18*math.tau+.12
    r=10.85
    flower_cluster(f"EXT Near Flower {i}",math.sin(a)*r,math.cos(a)*r,.20,.72+(i%3)*.10,i)

# ---------- boat ----------
def add_boat(idx, material, path_radius, duration, phase):
    root=bpy.data.objects.new(f"EXT Boat {idx}",None); COLL.objects.link(root)
    hull=cube(f"EXT Boat {idx} Hull",(.65,.22,.14),(0,0,0),material,bevel=.12); hull.parent=root
    bow=cone(f"EXT Boat {idx} Bow",.22,0,.55,(.70,0,.02),material,rot=(0,math.radians(90),0),verts=16); bow.parent=root
    cabin=cube(f"EXT Boat {idx} Cabin",(.22,.17,.16),(-.12,0,.22),WHITE_M,bevel=.05); cabin.parent=root
    # mast/sail only on one
    if idx==1:
        mast=cyl(f"EXT Boat {idx} Mast",.025,.95,(0,0,.65),WOOD_D,12); mast.parent=root
        sail=cube(f"EXT Boat {idx} Sail",(.015,.30,.35),(.02,0,.70),WHITE_M,rot=(0,.0,.0),bevel=.02); sail.parent=root

    bpy.ops.curve.primitive_bezier_circle_add(radius=path_radius,location=(0,0,-.28))
    path=relink(bpy.context.object); path.name=f"EXT Boat Path {idx}"
    path.scale=(1.0,.72,1.0)
    c=root.constraints.new(type='FOLLOW_PATH'); c.target=path; c.use_fixed_location=True; c.forward_axis='FORWARD_X'; c.up_axis='UP_Z'
    c.offset_factor=phase
    c.keyframe_insert(data_path="offset_factor",frame=START_FRAME)
    c.offset_factor=phase+1.0
    c.keyframe_insert(data_path="offset_factor",frame=START_FRAME+duration)
    # linear loop
    if c.animation_data and c.animation_data.action:
        for fc in c.animation_data.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation='LINEAR'
            fc.modifiers.new('CYCLES')

boat_mats=[RED_M,BLUE_M,WOOD_M]
for i in range(BOAT_COUNT):
    add_boat(i,boat_mats[i%3],15.0+i*2.7,BOAT_SPEEDS[i%len(BOAT_SPEEDS)],i*.23)

# ---------- animation range ----------
bpy.context.scene.frame_start=START_FRAME
bpy.context.scene.frame_end=max(BOAT_SPEEDS)+1

# ---------- metadata ----------
for o in COLL.objects:
    o["generated_by"]="atelier_exterior_v1"

print("ATELIER EXTERIOR V1 added.")
print("Collection:", COLL_NAME)
print("Water, distant shore, village, trees, flowers, bridge and animated boats are separate from the interior.")
