
import bpy, math, mathutils
from mathutils import Vector

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def mat(name, color, roughness=0.6, metallic=0.0, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        m.surface_render_method = 'DITHERED'
    return m

def cyl(name, radius, depth, loc, material, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.object; o.name=name; o.data.materials.append(material); return o

def cube(name, scale, loc, material, rot=(0,0,0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b=o.modifiers.new("Bevel","BEVEL"); b.width=bevel; b.segments=3
    o.data.materials.append(material); return o

def sphere(name, scale, loc, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material); return o

def torus(name, major, minor, loc, material):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=72, minor_segments=12, location=loc)
    o=bpy.context.object; o.name=name; o.data.materials.append(material); return o

def look_at(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

clear_scene()

WOOD=mat("Warm Oak",(0.47,0.24,0.10),0.45)
WOOD_D=mat("Dark Oak",(0.20,0.08,0.035),0.56)
FLOOR=mat("Honey Floor",(0.60,0.32,0.15),0.52)
STONE=mat("Soft Stone",(0.66,0.58,0.49),0.72)
BRASS=mat("Brass",(0.72,0.42,0.10),0.28,0.72)
GLASS=mat("Glass",(0.80,0.94,1.0),0.08,0.0,0.95,0.26)
CANVAS=mat("Canvas",(0.95,0.91,0.84),0.9)
GREEN=mat("Leaf Green",(0.24,0.47,0.22),0.8)
GREEN2=mat("Leaf Green 2",(0.36,0.58,0.31),0.8)
PINK=mat("Pink",(0.95,0.54,0.65),0.7)
LILAC=mat("Lilac",(0.73,0.58,0.92),0.7)
PEACH=mat("Peach",(1.0,0.69,0.46),0.7)
BLUE=mat("Blue",(0.50,0.73,0.98),0.7)
CREAM=mat("Cream",(1.0,0.89,0.61),0.7)
FLOWERS=[PINK,LILAC,PEACH,BLUE,CREAM]

# Floor
cyl("Pavilion Floor",10.5,0.34,(0,0,-0.17),FLOOR,96)
cyl("Inner Floor",8.8,0.06,(0,0,0.03),FLOOR,96)
for i in range(24):
    a=i/24*math.tau
    x,y=math.sin(a)*4.2,math.cos(a)*4.2
    cube(f"Floor Seam {i:02d}",(0.008,4.2,0.003),(x,y,0.072),WOOD_D,rot=(0,0,-a))
for r in (2.6,5.4,8.15):
    torus(f"Floor Ring {r}",r,0.008,(0,0,0.075),WOOD_D)

# Columns and roof
R=9.5
for i in range(12):
    a=i/12*math.tau
    x,y=math.sin(a)*R,math.cos(a)*R
    cyl(f"Column {i:02d}",0.24,4.7,(x,y,2.35),WOOD,24)
    cyl(f"Column Cap {i:02d}",0.34,0.16,(x,y,4.78),BRASS,24)
    cube(f"Roof Beam {i:02d}",(0.09,4.8,0.09),(math.sin(a)*4.8,math.cos(a)*4.8,5.18),WOOD,rot=(math.radians(8),0,-a))
for r,z,t in ((9.5,4.72,0.16),(7.3,5.32,0.12),(4.8,5.86,0.10)):
    torus(f"Roof Ring {r}",r,t,(0,0,z),WOOD)

# Glass dome
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, location=(0,0,4.65))
d=bpy.context.object; d.name="Glass Dome"; d.scale=(9.55,9.55,6.7)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
d.data.materials.append(GLASS)

# Center table
cyl("Center Base",1.65,0.64,(0,0,0.32),WOOD_D)
cyl("Center Top",1.85,0.16,(0,0,0.72),WOOD)

# Easels
def add_easel(idx,x,y,rz):
    root=bpy.data.objects.new(f"Easel {idx:02d}",None); bpy.context.collection.objects.link(root)
    root.location=(x,y,0); root.rotation_euler[2]=rz
    def part(name,scale,loc,rot=(0,0,0),m=WOOD):
        o=cube(name,scale,loc,m,rot,0.02); o.parent=root; return o
    part(f"Easel {idx:02d} Leg L",(0.05,0.05,0.90),(-0.42,0,0.90),rot=(0,math.radians(-7),0))
    part(f"Easel {idx:02d} Leg R",(0.05,0.05,0.90),(0.42,0,0.90),rot=(0,math.radians(7),0))
    part(f"Easel {idx:02d} Rear Support",(0.05,0.05,0.88),(0,0.27,0.84),rot=(math.radians(-11),0,0))
    part(f"Easel {idx:02d} Shelf",(0.60,0.07,0.05),(0,-0.06,0.70))
    part(f"Easel {idx:02d} Canvas",(0.58,0.025,0.50),(0,-0.11,1.38),m=CANVAS)
    part(f"Easel {idx:02d} Clamp",(0.10,0.06,0.08),(0,-0.06,1.92),m=WOOD_D)

for i,(x,y,r) in enumerate([
    (-6.3,2.0,.28),(-3.8,-5.7,-.28),(1.6,-6.6,-.55),(6.1,-2.7,-1.0),
    (6.4,3.0,-2.35),(2.6,6.3,2.85),(-2.5,6.4,3.15),(-6.1,-2.6,.80)
]):
    add_easel(i,x,y,r)

# Floral clusters
def flower_puff(name,loc,scale=1.0,offset=0):
    root=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(root); root.location=loc
    for i in range(5):
        a=i/5*math.tau+.2
        o=sphere(f"{name} Leaf {i}",(0.18*scale,0.08*scale,0.045*scale),(math.cos(a)*.18*scale,math.sin(a)*.18*scale,-.02*scale),GREEN if i%2==0 else GREEN2)
        o.parent=root; o.rotation_euler[2]=a
    for i in range(13):
        a=i/13*math.tau; rad=(.10+.035*(i%3))*scale
        o=sphere(f"{name} Petal {i}",(.085*scale,.065*scale,.045*scale),(math.cos(a)*rad,math.sin(a)*rad,.02*((i%4)-1.5)*scale),FLOWERS[(i+offset)%len(FLOWERS)])
        o.parent=root
    c=sphere(f"{name} Core",(.09*scale,.07*scale,.05*scale),(0,0,0),CREAM); c.parent=root
    for i in range(6):
        a=i/6*math.tau+.35
        o=sphere(f"{name} Dot {i}",(.025*scale,)*3,(math.cos(a)*.24*scale,math.sin(a)*.24*scale,.025*(i%2)),FLOWERS[(i+2+offset)%len(FLOWERS)])
        o.parent=root

for i in range(12):
    a=i/12*math.tau
    flower_puff(f"Upper Flower {i:02d}",(math.sin(a)*8.0,math.cos(a)*8.0,4.95),.9,i)

for i in range(8):
    a=i/8*math.tau+math.radians(18)
    flower_puff(f"Lower Flower {i:02d}",(math.sin(a)*9.0,math.cos(a)*9.0,1.35),.68,i+2)

# Lighting
bpy.ops.object.light_add(type='AREA',location=(-6,-5,11))
key=bpy.context.object; key.name="Warm Sun"; key.data.energy=1500; key.data.shape='DISK'; key.data.size=6; key.data.color=(1.0,.80,.58); look_at(key,(0,0,1.5))
bpy.ops.object.light_add(type='AREA',location=(6,4,7))
fill=bpy.context.object; fill.name="Cool Fill"; fill.data.energy=650; fill.data.size=5; fill.data.color=(.72,.85,1.0); look_at(fill,(0,0,1.8))

# World
bpy.context.scene.world.use_nodes=True
bg=bpy.context.scene.world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value=(.72,.86,1.0,1); bg.inputs["Strength"].default_value=.55

# Camera
bpy.ops.object.camera_add(location=(13.5,-14.5,9.8))
cam=bpy.context.object; cam.name="Main Camera"; cam.data.lens=42; look_at(cam,(0,0,1.9)); bpy.context.scene.camera=cam

# Render
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.render.resolution_x=1600
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath='//atelier_pavilion_preview.png'
scene.view_settings.look='AgX - Medium High Contrast'

print("Atelier pavilion generated.")