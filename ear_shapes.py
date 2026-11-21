"""Volume-preserving ear rotations in the original mesh coordinate system."""
import numpy as np
from dog_frames import frame_profile

EAR_STYLES={'base':'Tai theo mẫu','upright':'Tai dựng','floppy':'Tai cụp','semi':'Tai bán dựng',
            'button':'Tai gập đầu','asymmetric':'Một dựng, một cụp','long_floppy':'Tai cụp dài'}


def shape_ears(points, cfg, style, weight=None):
    p=np.asarray(points,dtype=float).reshape(-1,3)
    x,y,z=p.T
    influence=np.ones(len(p)) if weight is None else np.clip(np.asarray(weight),0,1)
    # Optional rigid-flap correction for an upright photo ear. Applying most
    # of the rotation over the flap keeps intermediate skin weights from
    # curling the ear sideways. Defaults preserve existing catalog exports.
    rigidity=np.clip(float(cfg.get('ear_rigidity',0.)),0,1)
    influence=influence*(1-rigidity)+(1-(1-influence)**4)*rigidity
    hinge=np.c_[np.sign(x)*.135,np.full(len(p),1.195),np.full(len(p),.615)]
    local=p-hinge
    t=np.clip((1.195-y)/.18,0,1)
    lift=np.zeros(len(p))
    length=1.
    frame=frame_profile(cfg)
    if style=='base':
        if frame is not None and frame['ear_type']=='drop':
            length=frame['ear_height']/.18
        elif cfg.get('ears',0) or (frame is not None and frame['ear_type'] in ('pointed','bat')):
            lift[:]=-np.pi
            length=np.clip(.115*cfg['ears']/.18,.45,1.20)
        elif cfg.get('base_breed')=='pug':
            length=.65
    elif style=='upright':
        lift[:]=-np.pi
        length=.85
    elif style=='long_floppy':
        length=1.45
    elif style in ('semi','button'):
        lift[:]=-np.pi
        length=.85 if style=='semi' else .75
    elif style=='asymmetric':
        lift=np.where(x>0,-np.pi,0.)
        length=.9
    # Interpolate angles instead of blending a flap with its flipped copy.
    angle=lift*influence
    scale=np.exp(np.log(length)*influence)
    local[:,1]*=scale
    local[:,2]*=np.exp(np.log(.90)*influence) if np.any(lift) else scale
    local[:,0]*=1-.12*t*influence
    if style in ('semi','button'):
        # Bend an arc-length centerline and rotate its thickness frame. An
        # angle-only bend depending on Y folds the inside of a thick flap.
        start=.07 if style=='semi' else .025
        radius=.23 if style=='semi' else .13
        u=-local[:,1]
        distance=np.maximum(u-start,0)
        beta=distance*influence/radius
        safe=np.maximum(influence,1e-8)
        along=np.where(influence>1e-8,radius*np.sin(beta)/safe,distance)
        forward=radius*(1-np.cos(beta))/safe
        thickness=local[:,2].copy()
        local[:,1]=-np.minimum(u,start)-along-thickness*np.sin(beta)
        local[:,2]=-forward+thickness*np.cos(beta)
    c,s=np.cos(angle),np.sin(angle)
    yy=local[:,1]*c-local[:,2]*s
    zz=local[:,1]*s+local[:,2]*c
    local[:,1],local[:,2]=yy,zz
    small=1-.20*float(cfg.get('puppy_amount',0))*influence
    return hinge+local*small[:,None]
