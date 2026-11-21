"""Shared procedural actions for the game's dog rigs."""
import math
from panda3d.core import (Geom, GeomNode, GeomTriangles, GeomVertexData,
                         GeomVertexFormat, GeomVertexWriter, LineSegs, Mat4,
                         NodePath, TransparencyAttrib, Vec3)


class PeeAction:
    duration=4.6

    def __init__(self,game):
        self.game=game
        self.active=False
        self.elapsed=0.
        self.model=None
        self.control=None
        self.stream=None
        self.puddle=None
        self.wet_time=0.

    def start(self):
        if self.active:return
        game=self.game
        self.clear()
        self.model=game.model
        for clip in self.model.getAnimNames():
            self.model.stop(clip)
            self.model.setControlEffect(clip,0)
        self.model.pose('Idle',0)
        self.model.setControlEffect('Idle',1)
        self.model.update()
        exposed=self.model.exposeJoint(None,'modelRoot','thigh.L')
        self.world=Mat4(exposed.getMat(self.model))
        self.control=self.model.controlJoint(None,'modelRoot','thigh.L')
        self.local=Mat4(self.control.getMat())
        inverse=Mat4(self.local)
        inverse.invertInPlace()
        parent=inverse*self.world
        self.parent_inverse=Mat4(parent)
        self.parent_inverse.invertInPlace()
        self.pelvis=self.model.exposeJoint(None,'modelRoot','pelvis')
        self.active=True
        self.elapsed=0.
        game.weights={'Idle':1.}
        game.animation='Idle'
        game.preview=None
        game.speed=0.
        game.turn_rate=0.
        game.paused=False
        for key in game.keys:game.keys[key]=False

    def stop(self):
        if self.control is not None:
            self.control.setMat(self.local)
            self.model.releaseJoint('modelRoot','thigh.L')
            self.control=None
            self.model.loop('Idle')
        if self.stream is not None:
            self.stream.removeNode()
            self.stream=None
        self.active=False

    def clear(self):
        self.stop()
        if self.puddle is not None:
            self.puddle.removeNode()
            self.puddle=None
        self.wet_time=0.

    @staticmethod
    def ease(t):
        t=max(0.,min(1.,t))
        return t*t*(3-2*t)

    def update(self,dt):
        if not self.active:
            if self.puddle is not None and dt:
                self.wet_time+=dt
                self.puddle.setAlphaScale(max(0,1-self.wet_time/10))
                if self.wet_time>=10:
                    self.puddle.removeNode()
                    self.puddle=None
            return
        self.elapsed+=dt
        t=self.elapsed
        if t>=self.duration:
            self.stop()
            return
        amount=self.ease(t/.65)*self.ease((self.duration-t)/.65)
        # Rotate in actor space, then convert back into the joint's parent
        # coordinates. This works across different bone rest orientations.
        world=self.world*Mat4.rotateMat(-52*amount,Vec3(0,1,0))
        world.setRow(3,self.world.getRow(3))
        self.control.setMat(world*self.parent_inverse)
        self.model.update()
        if .85<t<self.duration-.8:
            self.draw_stream()
        elif self.stream is not None:
            self.stream.removeNode()
            self.stream=None

    def draw_stream(self):
        game=self.game
        height=game.dog_height
        heading=game.dog.getQuat(game.render)
        side=heading.xform(Vec3(-1,0,0))
        forward=heading.xform(Vec3(0,1,0))
        origin=self.pelvis.getPos(game.render)+forward*(height*.08)+side*(height*.05)
        origin.z=max(height*.16,origin.z-height*.30)
        lines=LineSegs('pee stream')
        lines.setThickness(1.7)
        lines.setColor(.78,.66,.20,.65)
        end=None
        for strand in range(3):
            for i in range(15):
                u=i/14
                wobble=math.sin(self.elapsed*24-u*16+strand)*height*.008*u
                point=origin+side*(height*.55*u)+forward*wobble
                point.z=origin.z-(origin.z-.008)*u*u
                if i==0:lines.moveTo(point)
                else:lines.drawTo(point)
                end=point
        if self.stream is not None:self.stream.removeNode()
        self.stream=game.render.attachNewNode(lines.create())
        self.stream.setLightOff()
        self.stream.setShaderOff()
        self.stream.setTransparency(TransparencyAttrib.MAlpha)
        self.stream.setDepthWrite(False)
        if self.puddle is None:
            self.puddle=game.render.attachNewNode(self.disc())
            self.puddle.setTransparency(TransparencyAttrib.MAlpha)
            self.puddle.setLightOff()
            self.puddle.setShaderOff()
            self.puddle.setDepthWrite(False)
            self.puddle.setPos(end.x,end.y,.006)
        size=height*(.07+.10*min(1,(self.elapsed-.85)/2.8))
        self.puddle.setScale(size,size*.72,1)
        self.wet_time=0.

    @staticmethod
    def disc():
        data=GeomVertexData('wet patch',GeomVertexFormat.getV3c4(),Geom.UHStatic)
        vertex=GeomVertexWriter(data,'vertex')
        color=GeomVertexWriter(data,'color')
        vertex.addData3(0,0,0)
        color.addData4(.42,.36,.14,.24)
        count=32
        for i in range(count):
            angle=i*2*math.pi/count
            vertex.addData3(math.cos(angle),math.sin(angle),0)
            color.addData4(.42,.36,.14,.24)
        faces=GeomTriangles(Geom.UHStatic)
        for i in range(count):faces.addVertices(0,i+1,(i+1)%count+1)
        geom=Geom(data)
        geom.addPrimitive(faces)
        node=GeomNode('wet patch')
        node.addGeom(geom)
        return node
