"""Regional anatomy cages and rest-skeleton proportions, independent of coat.

Frames share animation bone names, not their joint positions/proportions.
Descriptors are informed by linked breed standards; numeric values are visual
modeling choices rather than measured breed averages or pedigree diagnoses.
"""
import numpy as np

ANATOMY_VERSION=1

DEFAULT=dict(head_scale=1.,skull_width=1.,skull_height=1.,skull_depth=1.,dome=0.,
             muzzle_length=1.,snout_width=1.,snout_height=1.,neck_length=1.,neck_width=1.,head_forward=0.,nose_drop=0.,
             chest_width=1.,chest_depth=1.,waist_width=1.,waist_tuck=0.,
             pelvis_width=1.,body_length=1.,fore_lower=1.,fore_upper=1.,
             hind_lower=1.,hind_upper=1.,shoulder_span=1.,hip_span=1.,
             limb_thickness=1.,paw_size=1.,back_slope=0.,ear_type='drop',
             ear_height=.18,ear_width=.065,ear_splay=.05)

def preset(label,**values):return dict(DEFAULT,label=label,**values)

FRAMES={
 'retriever':preset('Cân đối / Retriever'),
 'toy_deer':preset('Đầu nhỏ / mõm thuôn',head_scale=.76,skull_width=.86,skull_height=.93,
    skull_depth=1.02,muzzle_length=1.02,snout_width=.73,snout_height=.90,neck_length=1.18,neck_width=.64,
    chest_width=.68,chest_depth=.85,waist_width=.66,waist_tuck=.15,pelvis_width=.70,
    body_length=.93,fore_lower=1.03,fore_upper=.98,hind_lower=1.05,hind_upper=.99,
    shoulder_span=.68,hip_span=.70,limb_thickness=.55,paw_size=.65,
    ear_type='pointed',ear_height=.20,ear_width=.065,ear_splay=.035),
 'toy_apple':preset('Đầu táo / sọ vòm',head_scale=.94,skull_width=1.09,skull_height=1.12,
    skull_depth=.91,dome=.035,muzzle_length=.59,snout_width=.81,neck_length=.95,neck_width=.74,
    chest_width=.78,chest_depth=.91,waist_width=.75,waist_tuck=.08,pelvis_width=.76,
    body_length=.91,fore_lower=.90,fore_upper=.91,hind_lower=.92,hind_upper=.92,
    shoulder_span=.76,hip_span=.77,limb_thickness=.63,paw_size=.69,
    ear_type='pointed',ear_height=.18,ear_width=.066,ear_splay=.03),
 'pariah_wedge':preset('Đầu nêm / chó bản địa',head_scale=.89,skull_width=.91,
    skull_height=.95,muzzle_length=1.15,snout_width=.86,neck_length=1.07,neck_width=.84,
    chest_width=.88,chest_depth=.98,waist_width=.83,waist_tuck=.19,pelvis_width=.88,
    shoulder_span=.88,hip_span=.88,limb_thickness=.84,paw_size=.88,ear_type='pointed'),
 'spitz':preset('Spitz / tai tam giác',head_scale=.95,skull_width=1.03,skull_height=1.02,
    muzzle_length=.87,snout_width=.88,neck_width=1.03,chest_width=1.03,pelvis_width=1.02,
    body_length=.96,waist_width=.96,limb_thickness=.98,ear_type='pointed',ear_height=.15),
 'herding':preset('Chăn cừu / cổ và mõm dài',head_scale=.91,skull_width=.89,
    skull_depth=1.08,muzzle_length=1.23,snout_width=.85,neck_length=1.18,neck_width=.85,
    chest_width=.89,chest_depth=1.12,waist_width=.78,waist_tuck=.27,
    body_length=1.08,fore_lower=1.10,fore_upper=1.08,hind_lower=1.04,hind_upper=1.02,
    shoulder_span=.89,hip_span=.88,limb_thickness=.84,ear_type='pointed'),
 'sighthound':preset('Săn tốc độ / ngực sâu eo thắt',head_scale=.80,skull_width=.74,
    skull_height=.85,skull_depth=1.14,muzzle_length=1.42,snout_width=.64,snout_height=.82,neck_length=1.42,neck_width=.63,
    chest_width=.73,chest_depth=1.52,waist_width=.57,waist_tuck=.52,pelvis_width=.78,
    body_length=1.12,fore_lower=1.23,fore_upper=1.16,hind_lower=1.25,hind_upper=1.18,
    shoulder_span=.73,hip_span=.78,limb_thickness=.62,paw_size=.80,back_slope=.025),
 'long_low':preset('Thân dài / chân ngắn',head_scale=.90,skull_width=.93,
    skull_depth=1.10,muzzle_length=1.12,neck_length=1.01,neck_width=.93,
    chest_width=1.06,chest_depth=1.10,waist_width=.94,waist_tuck=.06,pelvis_width=.98,
    body_length=1.58,fore_lower=.48,fore_upper=.54,hind_lower=.49,hind_upper=.56,
    shoulder_span=1.02,hip_span=1.,limb_thickness=1.00,paw_size=1.08),
 'brachy':preset('Mặt ngắn / ngực rộng',head_scale=1.08,skull_width=1.22,
    skull_height=1.06,skull_depth=.86,dome=.012,muzzle_length=.27,snout_width=1.18,
    neck_length=.87,neck_width=1.20,chest_width=1.30,chest_depth=1.03,
    waist_width=1.12,pelvis_width=1.03,body_length=.91,fore_lower=.70,fore_upper=.74,
    hind_lower=.72,hind_upper=.76,shoulder_span=1.28,hip_span=1.04,
    limb_thickness=1.12,paw_size=1.05),
 'bully':preset('Đầu khối / vai và hàm rộng',head_scale=1.12,skull_width=1.20,
    skull_height=1.02,skull_depth=.98,muzzle_length=.75,snout_width=1.18,snout_height=1.12,neck_length=.92,neck_width=1.25,
    chest_width=1.36,chest_depth=1.18,waist_width=1.06,waist_tuck=.08,pelvis_width=1.14,
    shoulder_span=1.35,hip_span=1.15,limb_thickness=1.20,paw_size=1.16),
 'hound':preset('Chó săn / tai rủ',head_scale=.96,skull_width=.98,skull_depth=1.08,
    muzzle_length=1.10,neck_length=1.08,chest_width=1.03,chest_depth=1.12,
    waist_width=.87,waist_tuck=.15,body_length=1.07,ear_height=.26),
 'tall_giant':preset('Cao lớn / chân và cổ dài',head_scale=.93,skull_width=.95,
    skull_depth=1.18,muzzle_length=1.12,snout_height=1.15,neck_length=1.40,neck_width=.92,
    chest_width=.98,chest_depth=1.30,waist_width=.80,waist_tuck=.27,
    fore_lower=1.35,fore_upper=1.28,hind_lower=1.36,hind_upper=1.30,
    shoulder_span=1.02,hip_span=1.,limb_thickness=1.0,paw_size=1.12),
 'egg_terrier':preset('Terrier / đầu dài hình trứng',head_scale=1.01,skull_width=.94,
    skull_height=1.03,skull_depth=1.18,dome=.025,muzzle_length=1.12,nose_drop=.075,
    neck_width=1.08,chest_width=1.13,chest_depth=1.14,waist_width=.88,waist_tuck=.16,
    shoulder_span=1.12,hip_span=1.02,limb_thickness=1.03,ear_type='pointed',ear_height=.13),
 'poodle_light':preset('Nhẹ / cổ cao chân thanh',head_scale=.85,skull_width=.86,
    skull_depth=1.12,muzzle_length=1.16,snout_width=.74,neck_length=1.30,neck_width=.70,
    chest_width=.80,chest_depth=1.05,waist_width=.71,waist_tuck=.25,
    fore_lower=1.12,fore_upper=1.08,hind_lower=1.13,hind_upper=1.10,
    shoulder_span=.80,hip_span=.80,limb_thickness=.68,paw_size=.80),
}

PARAMETER_LIMITS={key:((-.06,.06) if key in ('dome','back_slope') else
                        (-.12,.12) if key=='head_forward' else
                        (-.03,.09) if key=='nose_drop' else
                        (0.,.65) if key=='waist_tuck' else
                        (.08,.32) if key=='ear_height' else
                        (.025,.10) if key=='ear_width' else
                        (0.,.10) if key=='ear_splay' else (.20,1.75))
                  for key in DEFAULT if key!='ear_type'}

def frame_profile(cfg):
    name=cfg.get('anatomy_frame')
    if not name:return None
    return dict(FRAMES[name],**cfg.get('anatomy_overrides',{}))

def stride_scale(cfg):
    frame=frame_profile(cfg)
    if frame is None:return 1.
    return sum(frame[name] for name in ('fore_lower','fore_upper','hind_lower','hind_upper'))/4

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def hinge(x):return .5*(x+np.sqrt(x*x+.04**2))

def limb_height(y,lower,upper,leg):
    a=lower*leg;b=upper*leg
    return a*y+(b-a)*(hinge(y-.28)-hinge(-.28))+(1-b)*(hinge(y-.68)-hinge(-.68))

def head_mask(source):
    _,y,z=np.asarray(source).T
    return smooth(.32,.57,z)*smooth(.76,.96,y)

def apply_frame(source,points,cfg,pivot,ear_weights=None):
    """Map skin, bind joints and photo anchors through the same regional cage."""
    f=frame_profile(cfg)
    if f is None:return points
    source=np.asarray(source);out=np.asarray(points).copy();x,y,z=source.T
    front=smooth(-.10,.18,z)
    legacy=lambda v:cfg['leg']*v+(1-cfg['leg'])*(.5*((v-.65)+np.sqrt((v-.65)**2+.05**2))-.5*(-.65+np.sqrt(.65**2+.05**2)))
    fore=limb_height(y,f['fore_lower'],f['fore_upper'],cfg['leg'])
    hind=limb_height(y,f['hind_lower'],f['hind_upper'],cfg['leg'])
    out[:,1]+=front*fore+(1-front)*hind-legacy(y)
    neck=smooth(.18,.50,z)*smooth(.62,1.03,y)
    out[:,1]+=.20*(f['neck_length']-1)*neck
    out[:,2]+=f['head_forward']*neck
    h=head_mask(source)
    if ear_weights is not None:h=np.maximum(h,smooth(.02,.16,np.asarray(ear_weights)))
    pivot=np.asarray(pivot).copy()
    pivot[1]+=limb_height(np.array([1.10]),f['fore_lower'],f['fore_upper'],cfg['leg'])[0]-legacy(1.10)
    pivot[1]+=.20*(f['neck_length']-1)
    pivot[2]+=f['head_forward']
    age=1+.15*cfg.get('puppy_amount',0.)
    scale=f['head_scale']*age*np.array([f['skull_width'],f['skull_height'],f['skull_depth']])
    out+=h[:,None]*(out-pivot)*(scale-1)
    dome=np.exp(-((z-.61)/.19)**2)*smooth(1.05,1.22,y)
    out[:,1]+=f['dome']*dome
    out[:,1]-=f['nose_drop']*smooth(.58,.97,z)*h
    throat=neck*(1-h)
    out[:,0]*=1+(f['neck_width']-1)*throat
    chest=smooth(-.10,.12,z)*(1-smooth(.42,.62,z))*smooth(.38,.58,y)*(1-smooth(1.,1.16,y))
    waist=smooth(-.65,-.40,z)*(1-smooth(-.10,.18,z))*smooth(.32,.54,y)*(1-smooth(.98,1.14,y))
    hip=(1-smooth(-.42,-.12,z))*smooth(.40,.65,y)*(1-smooth(1.,1.12,y))
    out[:,0]*=(1+(f['chest_width']-1)*chest)*(1+(f['waist_width']-1)*waist)*(1+(f['pelvis_width']-1)*hip)
    underside=1-smooth(.70,.94,y)
    depth_zone=smooth(-.10,.12,z)*(1-smooth(.42,.62,z))*smooth(.20,.70,y)*(1-smooth(1.,1.16,y))
    vertical_scale=cfg['leg']*min(f['fore_lower'],f['fore_upper'],f['hind_lower'],f['hind_upper'])
    out[:,1]-=.16*(f['chest_depth']-1)*depth_zone*underside*vertical_scale
    out[:,1]+=.20*f['waist_tuck']*waist*underside
    rear=1-smooth(.05,.35,z)
    out[:,2]+=(f['body_length']-1)*(z-.35)*rear
    out[:,1]+=f['back_slope']*(1-smooth(-.50,.25,z))*smooth(.80,1.02,y)
    limb=(1-smooth(.58,.82,y))*smooth(.025,.16,abs(x))
    center=np.where(z>0,.15,.20)*cfg['width']
    spread=front*f['shoulder_span']+(1-front)*f['hip_span']
    out[:,0]=out[:,0]*(1+(f['limb_thickness']-1)*limb)+np.sign(x)*center*(spread-f['limb_thickness'])*limb
    paw=1-smooth(.075,.18,y)
    center_x=np.sign(x)*center*spread
    center_z=np.where(z>0,.537,-.514)*cfg['length']
    raw_center=np.where(z>0,.537,-.514)
    center_z+=(f['body_length']-1)*(raw_center-.35)*(1-smooth(.05,.35,raw_center))
    out[:,0]+=(f['paw_size']-1)*(out[:,0]-center_x)*paw
    out[:,2]+=(f['paw_size']-1)*(out[:,2]-center_z)*paw
    return out

def authored_ears(cfg,style='base'):
    frame=frame_profile(cfg)
    return frame is not None and (style=='upright' or (frame['ear_type'] in ('pointed','bat') and style=='base'))

def frame_tail(points,root,cfg):
    """Monotone tail shortening in the already transformed frame coordinates."""
    tail=cfg.get('tail','natural')
    if tail=='natural':return points
    out=points.copy();x,y,z=out.T.copy()
    width=cfg['width']
    gate=1-smooth(.05*width,.10*width,abs(x-root[0]))
    behind=root[2]-z
    if tail in ('bob','short'):
        compression=.10 if tail=='bob' else .32
        out[:,2]+=gate*(1-compression)*.5*(behind+np.sqrt(behind*behind+.025**2))
        amount=gate*smooth(.02,.22,behind)*(1-compression)
        out[:,1]=root[1]+(y-root[1])*(1-amount)
    elif tail=='curl':out[:,1]+=gate*.55*smooth(.02,.45,behind)
    return out

def ear_tip_source(cfg,side):
    f=frame_profile(cfg)
    return np.array([side*(.135+f['ear_splay']),1.195+f['ear_height']*(1-.18*cfg.get('puppy_amount',0.)),.60])

def bind_source_point(name,point,cfg,style='base'):
    if name in ('ear_tip.L','ear_tip.R') and authored_ears(cfg,style):
        return ear_tip_source(cfg,1 if name.endswith('.L') else -1)
    return point
