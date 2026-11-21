"""Closed, newly authored pointed/bat ear meshes for anatomical frames.

These replace the source hanging flap rather than rotating that flap upright.
The existing head/ear joint names remain available to the animation system.
"""
import numpy as np
from dog_frames import frame_profile,ear_tip_source
from dog_shape import smooth_mesh_normals


def make_ears(cfg,warp,joint_slots):
    frame=frame_profile(cfg);points=[];colors=[];ids=[];weights=[];faces=[]
    sides=12;rows=6
    for sign,name in ((1,'ear.L'),(-1,'ear.R')):
        offset=len(points)
        color=np.asarray(cfg.get('color',[.4,.2,.1]),dtype=float)
        root=np.array([sign*.135,1.195,.615])
        tip=ear_tip_source(cfg,sign)
        t_values=np.linspace(0,.96,rows)
        for t in t_values:
            center=root+(tip-root)*t
            shape=(1-t)**(.62 if frame['ear_type']=='bat' else .92)
            width=frame['ear_width']*shape
            for side in range(sides):
                angle=2*np.pi*side/sides
                thickness=.035*(1-t)**2+.003*(1-t)
                p=center+np.array([width*np.cos(angle),0,thickness*np.sin(angle)])
                points.append(p)
                inner=max(0,np.sin(angle))*.65
                rgb=color*.72*(1-inner)+(color*.25+np.array([.11,.035,.025]))*inner
                colors.append([*rgb,1.])
                amount=.30+.50*t
                ids.append([joint_slots[name],joint_slots['head'],0,0])
                weights.append([amount,1-amount,0,0])
        points.append(tip);colors.append([*(color*.65),1.])
        ids.append([joint_slots[name],joint_slots['head'],0,0]);weights.append([.8,.2,0,0])
        tip_index=offset+rows*sides
        for row in range(rows-1):
            for side in range(sides):
                a=offset+row*sides+side;b=offset+row*sides+(side+1)%sides
                faces.extend([[a,b,a+sides],[b,b+sides,a+sides]])
        for side in range(sides):
            faces.append([offset+(rows-1)*sides+side,offset+(rows-1)*sides+(side+1)%sides,tip_index])
        for side in range(1,sides-1):faces.append([offset,offset+side+1,offset+side])
    source=np.asarray(points);triangles=np.asarray(faces,dtype=int)[:,[0,2,1]]
    final=warp(source,np.zeros(len(source)))
    normals=smooth_mesh_normals(source,final,triangles)
    return dict(positions=final,normals=normals,colors=np.asarray(colors),
                uv=np.zeros((len(source),2)),joints=np.asarray(ids,dtype=np.uint16),
                weights=np.asarray(weights),indices=triangles.reshape(-1))
