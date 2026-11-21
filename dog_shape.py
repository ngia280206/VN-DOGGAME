"""Anatomical mesh, bind-joint and photo-anchor deformation shared by exporters."""
import numpy as np
from ear_shapes import shape_ears
from dog_frames import apply_frame,frame_profile,frame_tail,authored_ears

GEOMETRY_VERSION=6

# Visual starting points, not breed standards. Existing photo profiles can
# override these independently of body size and muzzle length.
MUZZLE_PROFILES={
    'phu_quoc': (.90,.42,.90,.22),
    'song_ma': (.88,.46,.88,.28),
    'cho_ta': (.92,.35,.92,.16),
    'vietnam_mix': (.96,.25,.95,.10),
    'bac_ha': (.96,.27,.94,.12),
    'hmong_bobtail': (1.,.18,.97,.06),
}
APPEARANCE_LIMITS={
    'muzzle_width': (.65,1.25), 'muzzle_taper': (0.,.55),
    'muzzle_height': (.70,1.20), 'muzzle_extension': (0.,.40),
    'fur_length': (0.,.14),
}


def appearance_profile(cfg):
    width,taper,height,extension=MUZZLE_PROFILES.get(cfg.get('base_breed'),(1.,0.,1.,0.))
    defaults=dict(muzzle_width=width,muzzle_taper=taper,muzzle_height=height,
                  muzzle_extension=extension,fur_length=max(0.,cfg.get('fur',0.)-.04)*.36)
    return {key:cfg.get(key,value) for key,value in defaults.items()}


def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)


def soft_hinge(x, radius=.025):
    return .5*(x+np.sqrt(x*x+radius*radius))


def leg_height(y, leg):
    # Smooth, strictly increasing replacement for the hard knee-height kink.
    return leg*y+(1-leg)*(soft_hinge(y-.65,.05)-soft_hinge(-.65,.05))


def _legacy_deform(points, cfg, ear_weight=None, ear_style='base'):
    p=np.asarray(points,dtype=float).reshape(-1,3).copy()
    family=cfg.get('base_breed','')
    puppy=float(cfg.get('puppy_amount',0))
    if ear_weight is not None:
        p=shape_ears(p,cfg,ear_style,ear_weight)
    x,y,z=p.T
    head=smooth(.28,.60,z)*smooth(.78,1.04,y)
    out=p.copy()
    out[:,1]=leg_height(y,cfg['leg'])
    out[:,0]=x*(cfg['width']+(cfg['head']-cfg['width'])*head)
    # Torso length must not squeeze skull depth. This blends positive depth
    # derivatives, keeping the head volumetric even on compact body models.
    skull_depth=1+.10*(cfg['head']-1)+.035*puppy
    upper=smooth(.78,1.02,y)
    out[:,2]=z*cfg['length']+upper*(skull_depth-cfg['length'])*(soft_hinge(z-.36,.06)-soft_hinge(-.36,.06))
    compression=np.clip(cfg['muzzle'],.25,1.15)
    frame=frame_profile(cfg)
    if frame is not None:compression=np.clip(cfg['muzzle']*frame['muzzle_length'],.18,1.5)
    elif family=='pug':compression=.30*(1-.15*puppy)
    elif family=='chihuahua':compression=.68*(1-.20*puppy)
    out[:,2]-=upper*skull_depth*(1-compression)*soft_hinge(z-.78)
    # Keep the skull and eyes broad while tapering both lips, the jaw, teeth
    # and nose together. The same map moves bind joints and photo anchors.
    appearance=appearance_profile(cfg)
    face=smooth(.84,.98,y)*(1-smooth(1.14,1.23,y))
    snout=smooth(.65,.82,z)*face
    taper=smooth(.76,.99,z)*face
    youthful=1-.35*puppy
    out[:,0]*=(1+snout*(appearance['muzzle_width']-1)*youthful)
    out[:,0]*=1-taper*appearance['muzzle_taper']*youthful
    out[:,1]+=snout*(appearance['muzzle_height']-1)*(y-1.04)*youthful
    if frame is not None:
        nose=smooth(.72,.87,z)*face
        out[:,0]*=1+nose*(frame['snout_width']-1)
        out[:,1]+=nose*(frame['snout_height']-1)*(y-1.04)
    out[:,2]+=snout*appearance['muzzle_extension']*soft_hinge(z-.74)*youthful
    # Moderate vertical adjustment prevents the old peaked forehead.
    out[:,1]+=.25*(cfg['head']-1)*(y-1.12)*head
    cranium=smooth(.97,1.12,y)*np.exp(-((z-.61)/.22)**2)
    cheeks=smooth(.95,1.10,y)*(1-smooth(1.15,1.28,y))*smooth(.44,.62,z)*(1-smooth(.78,.90,z))
    roundness=(.09 if family=='chihuahua' else .025 if family=='pug' else 0.) if frame is None else 0.
    out[:,0]*=1+roundness*cranium+.07*puppy*(cranium+cheeks)
    out[:,1]+=.018*(family=='chihuahua' and frame is None)*cranium
    out[:,1]-=(.025*(family=='pug' and frame is None)+.04*puppy)*head
    # Broad, gradual ribcage/waist transitions preserve shoulder volume.
    body=smooth(.23,.58,y)*(1-smooth(.23,.52,z))*smooth(-.74,-.46,z)
    condition=cfg.get('body_condition',0)
    out[:,0]*=1+condition*body
    underside=smooth(.36,.56,y)*(1-smooth(.66,.86,y))
    out[:,1]-=.14*condition*body*underside*min(1,cfg['leg'])
    chest=smooth(.48,.76,y)*(1-smooth(.92,1.06,y))*smooth(.05,.30,z)*(1-smooth(.43,.64,z))
    out[:,0]*=1+.06*chest
    fur=cfg.get('fur',0)
    torso=smooth(.35,.70,y)*(1-smooth(.36,.70,z))
    out[:,0]*=1+fur*torso
    out[:,1]+=fur*.14*smooth(.80,1.10,y)
    if puppy:
        neck=smooth(.73,.94,y)*(1-smooth(1.05,1.19,y))*smooth(.20,.44,z)
        out[:,0]*=1+.12*puppy*neck
        abdomen=smooth(.36,.57,y)*(1-smooth(.69,.86,y))*smooth(-.60,-.36,z)*(1-smooth(.14,.38,z))
        out[:,1]-=.04*puppy*abdomen*min(1,cfg['leg']/.6)
        paw=1-smooth(.075,.21,y)
        front=z>0
        center_x=np.sign(x)*np.where(front,.15,.20)*cfg['width']
        center_z=np.where(front,.537,-.514)*cfg['length']
        out[:,0]+=.28*puppy*paw*(out[:,0]-center_x)
        out[:,2]+=.20*puppy*paw*(out[:,2]-center_z)
    # Do not move the rear legs when changing the tail. A monotone shortening
    # map replaces the previous fold-producing Z reversal.
    tail=cfg.get('tail','natural')
    gate=1-smooth(.05,.10,np.abs(x-.02))
    root_y=leg_height(np.full(len(p),.92),cfg['leg'])
    if tail in ('bob','short'):
        compression=.10 if tail=='bob' else .32
        out[:,2]+=gate*cfg['length']*(1-compression)*soft_hinge(-z-.54)
        amount=gate*smooth(.52,.76,-z)*(1-compression)
        out[:,1]=root_y+(out[:,1]-root_y)*(1-amount)
    elif tail=='curl':
        # A hooked carriage with ordered Z preserves tail and hip volume.
        amount=gate*smooth(.53,.99,-z)
        out[:,1]+=amount*.55
    return out


def deform(points,cfg,ear_weight=None,ear_style='base'):
    source=np.asarray(points,dtype=float).reshape(-1,3)
    if cfg.get('anatomy_frame'):
        if authored_ears(cfg,ear_style) and ear_weight is not None:
            ear_weight=np.zeros(len(source))
        natural=dict(cfg,tail='natural')
        out=_legacy_deform(source,natural,ear_weight,ear_style)
        pivot=_legacy_deform([[0,1.10,.60]],natural,None,ear_style)[0]
        out=apply_frame(source,out,cfg,pivot,ear_weight)
        if cfg.get('tail','natural')!='natural':
            root_source=np.array([[.02,.92,-.54]])
            root=apply_frame(root_source,_legacy_deform(root_source,natural,None,ear_style),cfg,pivot)[0]
            out=frame_tail(out,root,cfg)
        return out
    return _legacy_deform(source,cfg,ear_weight,ear_style)


def smooth_mesh_normals(source_points, positions, faces):
    """Area-weighted normals welded across coincident UV seams."""
    faces=np.asarray(faces,dtype=int).reshape(-1,3)
    triangles=positions[faces]
    cross=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
    _,groups=np.unique(np.round(source_points,6),axis=0,return_inverse=True)
    accumulated=np.zeros((groups.max()+1,3))
    for corner in range(3):np.add.at(accumulated,groups[faces[:,corner]],cross)
    normal=accumulated[groups]
    length=np.linalg.norm(normal,axis=1,keepdims=True)
    normal=np.divide(normal,length,out=np.zeros_like(normal),where=length>1e-20)
    return normal
