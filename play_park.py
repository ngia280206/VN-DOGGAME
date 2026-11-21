"""Explore Labrador Park. Run with the project's .venv Python."""
from pathlib import Path
import math
import sys

import gltf
import simplepbr
from direct.actor.Actor import Actor
from direct.gui.OnscreenText import OnscreenText
from direct.gui.DirectGui import DirectButton, DirectFrame, DirectSlider, DirectScrolledFrame
from catalog import AVAILABLE_DOGS as DOGS, ROOT
from model_assets import read_document
from dog_actions import PeeAction
from dog_fur import soften_fur_rendering
from coat_render import apply_coat_detail
from motion_math import damp_heading,integrate_speed,response
from dog_frames import stride_scale
from panda3d.core import LineSegs, TextNode
from direct.showbase.ShowBase import ShowBase
from panda3d.core import AmbientLight, BitMask32, CardMaker, DirectionalLight, Material, NodePath, Vec3, WindowProperties, loadPrcFileData

MOVEMENT_MULTIPLIER = 1.6
loadPrcFileData("", "window-title Dog Motion Lab\nwin-size 1280 800\nsync-video true\nframebuffer-srgb false\ngl-version 3 3\ninterpolate-frames true\ntexture-anisotropic-degree 16")

class Park(ShowBase):
    def __init__(self):
        super().__init__()
        self.disableMouse()
        font_path = Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
        if font_path.exists():
            from direct.gui import DirectGuiGlobals
            font=self.loader.loadFont(str(font_path));font.setPixelsPerUnit(48)
            DirectGuiGlobals.setDefaultFont(font)
            TextNode.setDefaultFont(font)
        self.setBackgroundColor(.105, .12, .14, 1)
        self.pipeline = simplepbr.init(exposure=0., enable_shadows=True, shadow_bias=.0006,
                                      max_lights=4,msaa_samples=4,use_hardware_skinning=True)
        self.cam.node().getLens().setFov(50)
        self.camLens.setNearFar(.04, 250)
        self.create_map()
        self.dog = self.render.attachNewNode("dog controller")
        self.dog.setPos(0, -6, .008)
        self.model = None
        self.pee = PeeAction(self)
        self.shape_reference = {}
        self.catalog = list(DOGS)
        self.dog_types = [(d['name'],d['asset'],d['height'],1.0,'labrador') for d in self.catalog]
        if getattr(self,'initial_ear_asset',None):
            i=getattr(self,'initial_index',0)
            row=list(self.dog_types[i]);row[1]=self.initial_ear_asset;self.dog_types[i]=tuple(row)
        self.animation = "Idle"
        self.preview = None
        self.playback = 1.0
        self.paused = False
        self.show_skeleton = False
        self.skeleton_node = None
        self.weights = {}
        self.breed_buttons = []
        self.coat_choice = "Natural"
        self.coat_buttons = {}
        self.selection_text = OnscreenText(text="", pos=(0, .90), scale=.043, fg=(1,1,1,1), shadow=(0,0,0,.8), mayChange=True)
        self.create_controls()
        self.select_dog(getattr(self,"initial_index",0))
        ambient = AmbientLight("ambient"); ambient.setColor((.16, .18, .21, 1))
        self.render.setLight(self.render.attachNewNode(ambient))
        sun = DirectionalLight("sun"); sun.setColor((2.0, 1.88, 1.72, 1))
        sun.setShadowCaster(True, 2048, 2048)
        sun.setCameraMask(BitMask32.bit(2))
        sun.getLens().setFilmSize(12, 12)
        sun.getLens().setNearFar(1, 40)
        sun_np = self.render.attachNewNode(sun)
        sun_np.setPos(-6, 8, 14); sun_np.lookAt(0, -6, 0)
        self.sun_np = sun_np
        # Gentle viewing fill keeps dark eyes and muzzles legible from any angle.
        fill = DirectionalLight("camera fill")
        fill.setColor((.42, .44, .47, 1))
        self.render.setLight(self.camera.attachNewNode(fill))
        self.render.setLight(sun_np)
        self.keys = {k: False for k in ("up", "down", "left", "right", "run")}
        for key, action in (("w", "up"), ("arrow_up", "up"), ("s", "down"), ("arrow_down", "down"), ("a", "left"), ("arrow_left", "left"), ("d", "right"), ("arrow_right", "right"), ("shift", "run")):
            self.accept(key, self.key, [action, True]); self.accept(key + "-up", self.key, [action, False])
        self.yaw = 145.0
        self.pitch = 16.0
        self.zoom_factor=1.1
        self._status_elapsed=0.
        self._status_last=''
        self.speed = 0.0
        self.turn_rate = 0.0
        self.backwards = False
        self.mouse_captured = False
        self.accept("escape", self.capture_mouse, [False])
        self.accept("mouse3", self.capture_mouse, [True])
        self.accept("b", self.toggle_skeleton)
        self.accept("space", self.toggle_pause)
        self.accept("r", self.reset_dog)
        self.accept("e", self.start_pee)
        self.accept('wheel_up',self.zoom_by,[.90])
        self.accept('wheel_down',self.zoom_by,[1.10])
        self.accept("q", sys.exit)
        for number in range(1, min(9,len(self.dog_types)) + 1):
            self.accept(str(number), self.select_dog, [number - 1])
        self.accept("window-event", self.window_event)
        OnscreenText(text="WASD: move | Shift: run | Scroll: zoom | Right click: camera | Esc: release | Space: pause | R: reset", pos=(0, -.93), scale=.029, fg=(1,1,1,1), shadow=(0,0,0,.8))
        self.hint = OnscreenText(text="Right click to capture camera | Esc to use controls", pos=(0, .83), scale=.05, fg=(1,1,1,1), shadow=(0,0,0,.8))
        self.camera.setPos(0, -11, 2.4)
        self.capture_mouse(False)
        self.taskMgr.add(self.update, "move dog")

    def key(self, action, value): self.keys[action] = value

    def select_dog(self, index):
        self.pee.clear()
        if 'preview_exposure' in self.catalog[index]:
            self.pipeline.exposure=max(-1.,min(1.,float(self.catalog[index]['preview_exposure'])))
        label, filename, height, speed_scale, kind = self.dog_types[index]
        next_model = Actor(NodePath(gltf.load_model(str(ROOT / filename))))
        soften_fur_rendering(next_model)
        animations = {"labrador": {"Idle":"Idle", "Walk":"Walk", "Trot":"Trot", "Gallop":"Gallop"},
                      "pug": {"Idle":"Idle", "Walk":"Walk", "Trot":"Walk", "Gallop":"Run"},
                      "gobkit": {"Idle":"idle", "Walk":"walk", "Trot":"walk", "Gallop":"walk"}}[kind]
        lower, upper = next_model.getTightBounds()
        visible_lower, visible_upper = lower, upper
        if filename == self.catalog[index]['asset']:
            self.shape_reference[index]=(lower,upper)
        elif index not in self.shape_reference:
            reference=Actor(NodePath(gltf.load_model(str(ROOT/self.catalog[index]['asset']))))
            self.shape_reference[index]=reference.getTightBounds()
            reference.cleanup();reference.removeNode()
        lower,upper=self.shape_reference[index]
        scale = height / (self.catalog[index].get('normalization_height') or (upper.z - lower.z))
        next_model.reparentTo(self.dog)
        next_model.setH(180)
        next_model.setScale(scale)
        next_model.setPos((lower.x + upper.x) * .5 * scale, (lower.y + upper.y) * .5 * scale, -lower.z * scale)
        next_model.enableBlend()
        next_model.setBlend(animBlend=True,frameBlend=True)
        self.animation = "Idle"
        self.preview = None
        self.weights = {animations["Idle"]: 1.0}
        next_model.loop(animations["Idle"])
        next_model.setControlEffect(animations["Idle"], 1.0)
        if self.model is not None:
            self.model.cleanup()
            self.model.removeNode()
        self.model = next_model
        self.coat_detail_geoms=apply_coat_detail(self.model,self.catalog[index]['profile'],self.pipeline)
        self.motion_rates={animations['Idle']:1.}
        self.applied_rates={}
        self.apply_coat(self.coat_choice)
        self.dog_height = height
        self.model_extents = (visible_upper-visible_lower)*scale
        self.preview_elapsed = 0.0
        self.speed = 0.0
        self.paused = False
        self.selected_index = index
        self.dog_scale = scale * self.catalog[index]["profile"]["leg"] * stride_scale(self.catalog[index]['profile'])
        self.anim_names = animations
        self.selection_text.setText(f"DOG MOTION LAB   /   {label}")
        self.setup_skeleton(ROOT / filename)
        for i, button in enumerate(self.breed_buttons):
            button['frameColor'] = (.16, .48, .42, 1) if i == index else (.13, .20, .23, 1)
        for button in getattr(self, 'clip_buttons', []): button.destroy()
        self.clip_buttons = []
        clips = next_model.getAnimNames()
        for i, clip in enumerate(c for c in clips if c.lower() not in ('attack', 'bite', 'bite_up', 'death', 'death_slow', 'death_fast', 'dead', 'look', 'turn', 'jump_running', 'jump')):
            button = DirectButton(parent=self.panel, text=clip.replace('_', ' '), scale=.034,
                pos=(.015 + (i % 2)*.225, 0, -.87 - (i // 2)*.065),
                frameSize=(-.2, 5.9, -.65, 1.0), text_align=TextNode.ALeft,
                frameColor=(.18,.28,.30,1), text_fg=(.9,.96,.94,1),
                command=self.preview_clip, extraArgs=[clip])
            self.clip_buttons.append(button)
        i=len(self.clip_buttons)
        self.clip_buttons.append(DirectButton(parent=self.panel,text='Pee [E]',scale=.034,
            pos=(.015+(i%2)*.225,0,-.87-(i//2)*.065),
            frameSize=(-.2,5.9,-.65,1.0),text_align=TextNode.ALeft,
            frameColor=(.18,.28,.30,1),text_fg=(.9,.96,.94,1),command=self.start_pee))
        self.rig_text.setText(f"{len(self.joints)} joints | {len(clips)} clips\nSmooth animation blending")

    def create_controls(self):
        self.panel = DirectFrame(parent=self.a2dTopLeft, frameColor=(.055,.10,.12,.94),
                                 frameSize=(0,.53,-1.76,0), pos=(.035,0,-.15))
        def label(text, z, scale=.04):
            return OnscreenText(parent=self.panel, text=text, pos=(.035,z), scale=scale,
                align=TextNode.ALeft, fg=(.88,.95,.92,1), mayChange=True)
        label("CHOOSE YOUR DOG", -.06)
        self.breed_scroll = DirectScrolledFrame(parent=self.panel, frameSize=(.015,.51,-.51,-.10),
            canvasSize=(0,.45,-len(self.catalog)*.075,0), scrollBarWidth=.025, frameColor=(.07,.11,.13,1))
        for i, dog in enumerate(self.catalog):
            self.breed_buttons.append(DirectButton(parent=self.breed_scroll.getCanvas(),
                text=f"{i+1:02}  {dog['name']}", pos=(.015,0,-.05-i*.075),
                scale=.031, text_align=TextNode.ALeft, frameSize=(-.2,13.6,-.6,1.1),
                text_fg=(1,1,1,1), command=self.select_dog, extraArgs=[i]))
        self.rig_text = label("", -.60, .029)
        label("ANIMATION TESTS", -.76)
        DirectButton(parent=self.panel, text="Free movement", scale=.035, pos=(.25,0,-1.47),
                     command=self.preview_clip, extraArgs=[None])
        DirectButton(parent=self.panel, text="Bones [B]", scale=.032, pos=(.13,0,-1.56), command=self.toggle_skeleton)
        DirectButton(parent=self.panel, text="Pause [Space]", scale=.032, pos=(.38,0,-1.56), command=self.toggle_pause)
        label("Playback speed", -1.65, .03)
        self.speed_slider = DirectSlider(parent=self.panel, range=(.2,2), value=1,
            scale=.20, pos=(.27,0,-1.70), command=self.change_playback)
        self.coat_panel = DirectFrame(parent=self.a2dTopRight, pos=(-.56,0,-.16),
            frameColor=(.045,.06,.075,.96), frameSize=(0,.52,-.67,0))
        OnscreenText(parent=self.coat_panel, text="COAT COLOR", pos=(.035,-.065), scale=.035,
            align=TextNode.ALeft, fg=(.9,.93,.96,1))
        for i, name in enumerate(("Natural", "Darker", "Chocolate", "Black", "Golden")):
            self.coat_buttons[name] = DirectButton(parent=self.coat_panel, text=name,
                pos=(.035,0,-.14-i*.073), scale=.033, text_align=TextNode.ALeft,
                frameSize=(-.3,13.5,-.6,1.1), text_fg=(.94,.95,.96,1),
                command=self.apply_coat, extraArgs=[name])
        OnscreenText(parent=self.coat_panel, text="Scene brightness", pos=(.035,-.56), scale=.029,
            align=TextNode.ALeft, fg=(.8,.84,.87,1))
        self.light_slider = DirectSlider(parent=self.coat_panel, range=(-2.0,.5), value=self.pipeline.exposure,
            scale=.19, pos=(.26,0,-.62), command=self.change_lighting)
        self.status = OnscreenText(text="", pos=(0,-.85), scale=.030, fg=(1,1,1,1), shadow=(0,0,0,.8), mayChange=True)

    def apply_coat(self, choice):
        self.coat_choice = choice
        tints = {"Natural": (1,1,1,1), "Darker": (.48,.43,.38,1),
                 "Chocolate": (.30,.17,.095,1), "Black": (.045,.050,.058,1),
                 "Golden": (1.0,.72,.36,1)}
        if self.model is not None:
            # Tint the coat only; retain the mouth, tongue and teeth materials.
            for geom in self.model.findAllMatches('**/+GeomNode'):
                node = geom.node()
                from panda3d.core import ColorScaleAttrib, MaterialAttrib
                for i in range(node.getNumGeoms()):
                    state = node.getGeomState(i)
                    material = state.getAttrib(MaterialAttrib)
                    if material and 'mouth' not in material.getMaterial().getName().lower():
                        node.setGeomState(i, state.setAttrib(ColorScaleAttrib.make(tints[choice]), 10))
        for name, button in self.coat_buttons.items():
            button['frameColor'] = (.20,.45,.39,1) if name == choice else (.13,.17,.20,1)

    def change_lighting(self):
        if hasattr(self, 'light_slider'):
            self.pipeline.exposure = self.light_slider['value']

    def change_playback(self):
        if hasattr(self, 'speed_slider'): self.playback = self.speed_slider['value']

    def preview_clip(self, clip):
        self.pee.stop()
        self.preview = clip
        self.preview_elapsed = 0.0
        self.paused = False

    def toggle_pause(self): self.paused = not self.paused
    def toggle_skeleton(self): self.show_skeleton = not self.show_skeleton

    def zoom_by(self,factor):
        self.zoom_factor=max(.55,min(2.8,self.zoom_factor*factor))

    def reset_dog(self):
        self.pee.clear()
        self.dog.setPos(0,-6,.008)
        self.dog.setH(0)
        self.speed = 0
        self.preview = None
        self.paused = False

    def start_pee(self):
        self.pee.start()

    def setup_skeleton(self, filename):
        if self.skeleton_node is not None: self.skeleton_node.removeNode()
        doc=read_document(filename)
        indices = set(j for skin in doc.get('skins',[]) for j in skin['joints'])
        self.joints = {}
        self.bone_names = {i:doc['nodes'][i].get('name','') for i in indices}
        for i in indices:
            name = doc['nodes'][i].get('name','')
            joint = self.model.exposeJoint(None, 'modelRoot', name)
            if not joint.isEmpty(): self.joints[i] = joint
        self.bone_edges = [(i,c) for i in indices for c in doc['nodes'][i].get('children',[]) if c in indices and doc['nodes'][i].get('name') not in ('root','cog')]

    def draw_skeleton(self):
        if self.skeleton_node is not None:
            self.skeleton_node.removeNode()
            self.skeleton_node = None
        if not self.show_skeleton: return
        lines = LineSegs('live skeleton'); lines.setThickness(2)
        for a,b in self.bone_edges:
            if a in self.joints and b in self.joints:
                name=self.bone_names.get(b,'')
                color=(.35,1,.55,1) if '.toe' in name else (1,.72,.25,1) if any(s in name for s in ('head','neck','jaw','ear','lip','tongue')) else (.72,.5,1,1) if 'tail' in name else (.25,.82,1,1)
                lines.setColor(*color)
                lines.moveTo(self.joints[a].getPos(self.render)); lines.drawTo(self.joints[b].getPos(self.render))
        # Small crosses mark actual joint centers even when segments overlap.
        radius=max(.003,self.dog_height*.006)
        lines.setColor(1,.96,.80,1)
        for i,joint in self.joints.items():
            if self.bone_names.get(i) in ('root','cog'):continue
            pos=joint.getPos(self.render)
            for offset in (Vec3(radius,0,0),Vec3(0,radius,0),Vec3(0,0,radius)):
                lines.moveTo(pos-offset);lines.drawTo(pos+offset)
        self.skeleton_node = self.render.attachNewNode(lines.create())
        self.skeleton_node.setDepthTest(False); self.skeleton_node.setDepthWrite(False)
        self.skeleton_node.setBin('fixed',40)
        self.skeleton_node.setLightOff()

    def create_map(self):
        # A clear, neutral baseplate for testing, with subtle concrete seams.
        concrete = Material('Matte charcoal concrete')
        concrete.setBaseColor((.17,.18,.20,1)); concrete.setRoughness(.97); concrete.setMetallic(0)
        ground = CardMaker('concrete baseplate'); ground.setFrame(-60,60,-60,60)
        plane = self.render.attachNewNode(ground.generate())
        plane.setP(-90); plane.setZ(0); plane.setMaterial(concrete, 1)
        grid = LineSegs('baseplate seams'); grid.setThickness(1)
        grid.setColor(.17,.185,.21,1)
        for n in range(-60,61,4):
            grid.moveTo(n,-60,.003);grid.drawTo(n,60,.003)
            grid.moveTo(-60,n,.003);grid.drawTo(60,n,.003)
        lines = self.render.attachNewNode(grid.create()); lines.setLightOff()
        self.blocks = []

    def window_event(self, window):
        # Preserve Panda3D lens/UI updates when the OS resizes the window.
        self.windowEvent(window)
        if window is not None and not window.getProperties().getForeground():
            for key in self.keys: self.keys[key] = False
            if self.mouse_captured: self.capture_mouse(False)

    def capture_mouse(self, capture):
        if not hasattr(self.win, 'requestProperties'):
            self.mouse_captured = False
            return
        self.mouse_captured = capture
        props = WindowProperties()
        props.setCursorHidden(capture)
        self.win.requestProperties(props)
        self.hint.setText("" if capture else "Right click to capture camera | Esc to use controls")
        if capture:
            self.win.movePointer(0, self.win.getXSize() // 2, self.win.getYSize() // 2)

    def update(self, task):
        frame_dt=min(max(self.clock.getDt(),0.),.10)
        dt=0. if self.paused else frame_dt
        if self.mouse_captured and self.win.getProperties().getForeground():
            cx, cy = self.win.getXSize() // 2, self.win.getYSize() // 2
            pointer = self.win.getPointer(0)
            self.yaw -= (pointer.getX() - cx) * .16
            self.pitch = max(-5, min(55, self.pitch + (pointer.getY() - cy) * .14))
            self.win.movePointer(0, cx, cy)
        # Project the camera's direction onto the ground so looking up or down
        # does not change movement speed or lift the dog off the floor.
        x = int(self.keys["right"]) - int(self.keys["left"])
        y = int(self.keys["up"]) - int(self.keys["down"])
        if self.pee.active and (x or y):self.pee.stop()
        camera_angle = math.radians(self.yaw)
        forward = Vec3(-math.sin(camera_angle), math.cos(camera_angle), 0)
        right = Vec3(math.cos(camera_angle), math.sin(camera_angle), 0)
        direction = right * x + forward * y
        has_input = direction.lengthSquared() > 0 and not self.paused
        if has_input: self.preview = None
        if has_input:
            direction.normalize()
            self.backwards = y < 0
            facing = -direction if self.backwards else direction
            desired_heading = math.degrees(math.atan2(-facing.x, facing.y))
            heading,self.turn_rate=damp_heading(self.dog.getH(),desired_heading,self.turn_rate,dt)
            self.dog.setH(heading)
        else:
            self.turn_rate*=math.exp(-12*dt)
        boosted = self.keys["run"]
        max_speed = (5.6 if boosted else 2.8) * self.dog_scale
        target_speed = ((2.5 if boosted else 1.5) * self.dog_scale if self.backwards else max_speed) if has_input else 0
        target_speed *= MOVEMENT_MULTIPLIER
        self.speed,distance_step=integrate_speed(self.speed,target_speed,12.,dt)
        if self.speed < .04 and not has_input:
            self.speed = 0
        moving = self.speed > 0
        relative_speed = self.speed / (self.dog_scale * MOVEMENT_MULTIPLIER)
        gait = "Gallop" if relative_speed > 3.6 else "Trot" if relative_speed > 1.7 else "Walk" if moving else "Idle"
        if self.preview:
            self.preview_elapsed += dt * self.playback
            successors = {"Sit": "Sit_Idle", "Lie_Down": "Lie_Idle", "Play_Bow": "Idle", "Shake": "Idle"}
            if self.preview in successors and self.preview_elapsed >= self.model.getDuration(self.preview):
                self.preview = successors[self.preview]
                self.preview_elapsed = 0.0
        if moving and self.animation=='Gallop' and relative_speed>3.35:gait='Gallop'
        elif moving and self.animation=='Trot' and 1.50<relative_speed<3.80:gait='Trot'
        self.animation = gait
        clip = self.preview or self.anim_names[gait]
        if clip not in self.weights:
            # Align gait phase so a transition keeps the same feet in swing.
            source=max(self.weights,key=self.weights.get) if self.weights else None
            locomotion=set(self.anim_names.values())-{'Idle'}
            if source in locomotion and clip in locomotion:
                frame=self.model.getCurrentFrame(source) or 0
                phase=frame/max(1,self.model.getNumFrames(source)-1)
                self.model.pose(clip,phase*(self.model.getNumFrames(clip)-1))
                self.model.loop(clip,restart=False)
            else:
                self.model.loop(clip)
            self.weights[clip] = 0.0
        for name in list(self.weights):
            target_weight = 1.0 if name == clip else 0.0
            self.weights[name] += (target_weight-self.weights[name]) * response(12.,dt)
            rate = self.playback
            if not self.preview and moving:
                nominal = {"Walk": .98, "Trot": 3.43, "Gallop": 4.14}[gait]
                rate *= max(.1,min(2.4,self.speed/(nominal*self.dog_scale))) * (-1 if self.backwards else 1)
            smoothed=self.motion_rates.get(name,rate)
            smoothed+=(rate-smoothed)*response(16.,dt)
            self.motion_rates[name]=smoothed
            applied=0. if self.paused else smoothed
            if abs(applied-self.applied_rates.get(name,999.))>.001:
                self.model.setPlayRate(applied,name);self.applied_rates[name]=applied
            if name != clip and self.weights[name] < .001:
                self.model.setControlEffect(name,0)
                self.model.stop(name)
                del self.weights[name]
                self.motion_rates.pop(name,None);self.applied_rates.pop(name,None)
        total=sum(self.weights.values())
        if total>0:
            for name,weight in self.weights.items():
                self.weights[name]=weight/total
                self.model.setControlEffect(name,self.weights[name])
        self.pee.update(dt)
        self.draw_skeleton()
        action='Pee' if self.pee.active else clip
        self._status_elapsed+=frame_dt
        status=f"{action}  |  {self.speed:.1f} m/s  |  {self.playback:.1f}x  |  {self.clock.getAverageFrameRate():.0f} fps"+("  |  PAUSED" if self.paused else "")
        if self._status_elapsed>=.1 and status!=self._status_last:
            self.status.setText(status);self._status_last=status;self._status_elapsed=0.
        if moving:
            heading = math.radians(self.dog.getH())
            travel = Vec3(-math.sin(heading), math.cos(heading), 0)
            if self.backwards:
                travel = -travel
            pos = self.dog.getPos() + travel * distance_step
            pos.x = max(-58, min(58, pos.x)); pos.y = max(-58, min(58, pos.y))
            if not any(abs(pos.x-bx) < hw and abs(pos.y-by) < hd for bx, by, hw, hd in self.blocks):
                self.dog.setPos(pos)
            else:
                self.speed = 0
        self.sun_np.setPos(self.dog.getPos() + Vec3(-6,8,14))
        self.sun_np.lookAt(self.dog.getPos())
        target = self.dog.getPos() + Vec3(0, 0, self.dog_height*.55)
        fov=self.camLens.getFov()
        aspect=max(.5,self.getAspectRatio())
        available=.94 if self.aspect2d.isHidden() else max(.28,min(.82,(2*aspect-1.22)/(2*aspect)))
        view_width=(abs(math.cos(camera_angle))*self.model_extents.x+
                    abs(math.sin(camera_angle))*self.model_extents.y)
        width_fit=view_width*1.18/(2*math.tan(math.radians(fov.x/2))*available)
        height_fit=max(self.dog_height,self.model_extents.z)*1.20/(2*math.tan(math.radians(fov.y/2)))
        distance=max(.42,width_fit,height_fit)*self.zoom_factor
        pitch = math.radians(self.pitch)
        camera_angle = math.radians(self.yaw)
        camera_forward = Vec3(-math.sin(camera_angle), math.cos(camera_angle), 0)
        desired = target - camera_forward * (distance * math.cos(pitch)) + Vec3(0, 0, distance * math.sin(pitch))
        desired.z = max(.18, desired.z)
        self.camera.setPos(self.camera.getPos() + (desired - self.camera.getPos()) * response(9.,frame_dt))
        self.camera.lookAt(target)
        return task.cont

if __name__ == "__main__":
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--breed',choices=[d['id'] for d in DOGS],default=DOGS[0]['id'])
    parser.add_argument('--ear-asset')
    args=parser.parse_args();Park.initial_ear_asset=args.ear_asset
    Park.initial_index=next(i for i,d in enumerate(DOGS) if d['id']==args.breed)
    Park().run()
