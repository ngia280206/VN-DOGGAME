"""Rooted, tapered fibres with gravity-shaped grooming for long coats.

Standard long coats use slender tubes; the detailed groom uses narrow curved
cutout clusters. Facial fuzz stays short. Roots inherit color and skin weights;
no floating coat shell is generated.
"""
import numpy as np
from dog_shape import appearance_profile, smooth
from dog_groom import detailed_groom,groom_regions,guide_flow,region_lengths
from fur_cards import build_cards

FUR_VERSION=5


def is_shaggy_coat(cfg):
    return cfg.get('fur',0.)>=.12 or cfg.get('fur_length',0.)>=.04


def unit(v):
    return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-12)


def crest_coverage(points):
    """Sparse head furnishings on an otherwise bare body, in source space."""
    x,y,z=np.asarray(points).T
    crown=smooth(1.16,1.23,y)*smooth(.39,.54,z)
    beard=smooth(.56,.72,z)*smooth(.93,1.01,y)*(1-smooth(1.09,1.16,y))
    socks=(1-smooth(.06,.16,y))*smooth(.07,.13,abs(x))
    return np.maximum.reduce([crown,beard,.18*socks])


def soften_fur_rendering(node):
    """Keep solid coat geometry opaque even in a translucent photo overlay."""
    from panda3d.core import AlphaTestAttrib,MaterialAttrib,TransparencyAttrib
    for path in node.findAllMatches('**/+GeomNode'):
        geom=path.node()
        for i in range(geom.getNumGeoms()):
            state=geom.getGeomState(i)
            attr=state.getAttrib(MaterialAttrib)
            material=attr.getMaterial() if attr else None
            if material and any(name in material.getName() for name in ('strand fur','sculpted fur')):
                state=state.setAttrib(TransparencyAttrib.make(TransparencyAttrib.M_none),2)
                state=state.setAttrib(AlphaTestAttrib.make(AlphaTestAttrib.M_always,0.),2)
                geom.setGeomState(i,state)


def fur_coverage(points, ear_weights=None, *, shaggy=False):
    x,y,z=np.asarray(points).T
    # Keep coat on the cheeks and forehead instead of shaving the entire
    # face. Exclude the actual nose, eye openings, lips, pads and ear flaps.
    coverage=smooth(.13,.28,y)
    nose=np.sqrt((x/.080)**2+((y-1.052)/.060)**2+((z-.917)/.058)**2)
    coverage*=smooth(1.,1.45,nose)
    lips=(1-smooth(.94,1.01,y))*smooth(.70,.84,z)
    coverage*=1-lips
    eyes=np.sqrt(((abs(x)-.092)/.037)**2+((y-1.165)/.032)**2+((z-.747)/.040)**2)
    coverage*=smooth(1.,1.5,eyes)
    if shaggy:
        # A larger safety margin also protects eyes from neighbouring hairs
        # hanging down from their roots. The shader supplies fine facial grain.
        eye_clearance=np.sqrt(((abs(x)-.092)/.061)**2+
                              ((y-1.165)/.055)**2+((z-.747)/.065)**2)
        coverage*=smooth(1.,1.45,eye_clearance)
        face=smooth(.61,.77,z)*smooth(.94,1.04,y)
        coverage*=1-.88*face
        lip_clearance=smooth(.67,.79,z)*(1-smooth(1.02,1.13,y))
        coverage*=1-lip_clearance
    if ear_weights is not None:
        coverage*=1-smooth(.03,.25,np.asarray(ear_weights))
    return coverage


def gravity_strands(roots,n,tangent,sideways,sizes,root_uv,root_colors,
                    root_ids,root_weights,source_roots,corners,bary,age,length,detailed=False):
    """Three tiny triangular rings and a tip: a tapered, drooping fibre.

    Gravity bends the exposed ends; top-facing roots keep clearance from the
    skin. This is a rest-shape groom, not a per-frame physical simulation.
    """
    count=len(roots);sides=3;rings=4 if detailed else 3;vertices_per_lock=rings*sides+1
    widths=np.clip(sizes*(.026 if detailed else .025),.00040 if detailed else .00042,
                   .00115 if detailed else .0010)*age
    times=np.array([0.,.25,.52,.80]) if detailed else np.array([0.,.38,.75])
    fullness=np.array([1.,.80,.51,.19]) if detailed else np.array([1.,.66,.28])
    angle=np.arange(sides)*2*np.pi/sides
    cos=np.cos(angle);sin=np.sin(angle)
    gravity=np.array([0.,-1.,0.])
    sag=.30*(1-np.maximum(n[:,1],0.)**2)
    regions=groom_regions(source_roots)
    # Most of the groom lies close to the coat; long breast/ruff hairs have
    # room to curve away from the skin and overlap before their tips droop.
    loft=(.14+.17*np.maximum(regions['neck'],regions['breast'])) if detailed else np.full(count,.16)
    wave=np.sin(source_roots[:,1]*37.+source_roots[:,2]*25.) if detailed else np.zeros(count)
    def centerline(t):
        lift=loft[:,None]*np.sin(np.pi*.8*t)
        return (roots[:,None,:]+tangent[:,None,:]*(sizes[:,None]*.88*t)[:,:,None]
                +n[:,None,:]*(sizes[:,None]*lift-widths[:,None]*.20)[:,:,None]
                +gravity*(sizes[:,None]*sag[:,None]*t*t)[:,:,None]
                +sideways[:,None,:]*(sizes[:,None]*.045*wave[:,None]*np.sin(np.pi*t)*t)[:,:,None])
    centers=centerline(times)
    direction=unit(tangent[:,None,:]*.88+
                   n[:,None,:]*(loft[:,None]*np.pi*.8*np.cos(np.pi*.8*times))[:,:,None]
                   +gravity*(2*sag[:,None]*times)[:,:,None])
    across=unit(np.cross(direction,sideways[:,None,:]))
    broad=widths[:,None]*fullness[None,:]
    thick=broad
    points=(centers[:,:,None,:]+sideways[:,None,None,:]*(broad[:,:,None]*cos)[:,:,:,None]
            +across[:,:,None,:]*(thick[:,:,None]*sin)[:,:,:,None])
    surface_normals=unit(sideways[:,None,None,:]*cos[None,None,:,None]
                        +across[:,:,None,:]*sin[None,None,:,None])
    radial_weight=.42 if detailed else .22
    surface_normals=unit(surface_normals*radial_weight+n[:,None,None,:]*(1-radial_weight))
    tip=centerline(np.array([1.]))[:,0]
    points=np.concatenate([points.reshape(count,rings*sides,3),tip[:,None,:]],axis=1)
    norms=np.concatenate([surface_normals.reshape(count,rings*sides,3),
                          n[:,None,:]],axis=1)
    tangents=np.repeat(direction,sides,axis=1)
    tangents=np.concatenate([tangents,tangents[:,-1:]],axis=1)
    tangents=unit(tangents-norms*np.sum(norms*tangents,axis=-1,keepdims=True))
    tangents=np.concatenate([tangents,np.ones((*tangents.shape[:2],1))],axis=-1)
    indices=[];offset=np.arange(count)[:,None]*vertices_per_lock
    for ring in range(rings-1):
        for side in range(sides):
            other=(side+1)%sides;a=ring*sides+side;b=ring*sides+other
            c=(ring+1)*sides+side;d=(ring+1)*sides+other
            indices.extend([offset+np.array([a,b,c]),offset+np.array([b,d,c])])
    for side in range(sides):
        indices.append(offset+np.array([(rings-1)*sides+side,
                                       (rings-1)*sides+(side+1)%sides,rings*sides]))
    def repeated(values):return np.repeat(values,vertices_per_lock,axis=0)
    return dict(positions=points.reshape(-1,3),normals=norms.reshape(-1,3),tangents=tangents.reshape(-1,4),
                uv=repeated(root_uv),colors=repeated(root_colors),
                joints=repeated(root_ids),weights=repeated(root_weights),source=repeated(source_roots),
                indices=np.concatenate(indices).reshape(-1),roots=roots,root_faces=corners,
                root_barycentric=bary,radii=widths,tuft_count=count,strand_count=count,length=length,
                element_vertices=vertices_per_lock,
                method='layered_anatomical_groom' if detailed else 'gravity_groomed_strands')


def build_fur(source, positions, normals, uv, colors, joints, weights, faces, cfg, ear_weights=None):
    length=appearance_profile(cfg)['fur_length']
    if length<=.004:
        return None
    source=np.asarray(source)
    faces=np.asarray(faces,dtype=int).reshape(-1,3)
    shaggy=is_shaggy_coat(cfg)
    detailed=shaggy and detailed_groom(cfg)
    coverage=fur_coverage(source,ear_weights,shaggy=shaggy)
    crested=cfg.get('fur_distribution')=='crest'
    if crested:coverage*=crest_coverage(source)
    tri=source[faces]
    area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)*.5
    probability=area*coverage[faces].min(1)
    center=tri.mean(1)
    tail_area=(1-smooth(.05,.10,abs(center[:,0]-.02)))*smooth(.52,.72,-center[:,2])
    head_area=smooth(.97,1.10,center[:,1])*smooth(.38,.60,center[:,2])
    probability*=1+2.5*tail_area+(.25 if shaggy else 1.8)*head_area
    if detailed:
        regions=groom_regions(center)
        probability*=1+2.0*regions['neck']+2.4*regions['breast']+.6*regions['feather']
    if probability.sum()<=0:
        return None
    # Source-space sampling is identical across body shapes and ages, so coat
    # identity and root correspondence do not change when proportions change.
    count=int(10000+min(length/.10,1)*6000) if shaggy else int(9000+min(length/.10,1)*9000)
    if detailed:count=int(3800+min(length/.10,1)*1200)
    if crested:count=2600
    rng=np.random.default_rng(4127)
    selected=rng.choice(len(faces),count,p=probability/probability.sum())
    corners=faces[selected]
    bary=rng.random((count,2))
    reflect=bary.sum(1)>1
    bary[reflect]=1-bary[reflect]
    bary=np.c_[1-bary.sum(1),bary]
    def interpolate(values):
        return np.einsum('ni,nij->nj',bary,np.asarray(values)[corners])
    source_roots=interpolate(source)
    keep=fur_coverage(source_roots,shaggy=shaggy)>.02
    corners=corners[keep];bary=bary[keep];source_roots=source_roots[keep];count=len(corners)
    roots=interpolate(positions)
    n=unit(interpolate(normals))
    x,y,z=source_roots.T
    neck=smooth(.12,.35,z)*smooth(.62,.95,y)
    tail=(1-smooth(.05,.10,abs(x-.02)))*smooth(.52,.72,-z)
    head=smooth(.99,1.12,y)*smooth(.40,.60,z)
    groom=np.c_[np.sign(x)*.12,np.full(count,-.78),-.65+.35*neck+.95*head]
    groom=groom*(1-tail[:,None])+np.array([0,.55,-.85])*tail[:,None]
    if shaggy:
        # Forehead hairs comb back, away from the eyes. Body and tail hairs
        # follow the skin downwards before their free ends sag further.
        groom=np.c_[np.sign(x)*.08,np.full(count,-1.),-.38-.35*head]
        groom=groom*(1-tail[:,None])+np.array([0.,-.85,-.55])*tail[:,None]
    if detailed:
        regions=groom_regions(source_roots)
        groom=guide_flow(source_roots,regions)
    tangent=groom-n*np.sum(groom*n,axis=1,keepdims=True)
    fallback=np.cross(n,np.tile([1.,0.,0.],(count,1)))
    tangent=np.where((np.linalg.norm(tangent,axis=1)<1e-5)[:,None],fallback,tangent)
    tangent=unit(tangent)
    sideways=unit(np.cross(n,tangent))
    age=1-.18*cfg.get('puppy_amount',0.)
    sizes=length*age*(.30+.32*rng.random(count))*(1+.65*neck+2.8*tail+.45*head)
    sizes*=.55+.45*smooth(.19,.48,y)
    if shaggy:
        face=smooth(.58,.74,z)*smooth(.76,.96,y)
        sizes*=1-.88*face
        sizes*=1-.38*head
    if detailed:
        sizes=length*age*(.50+.50*rng.random(count))*region_lengths(regions)
        sizes*=.45+.55*smooth(.16,.38,y)
        sizes=np.minimum(sizes,.004+.12*(1-regions['head']))
    if crested:
        sizes=length*age*(.45+.55*rng.random(count))*crest_coverage(source_roots)
    # Preserve the sampling stream and the lighter coats' original fine tubes.
    radii=(.00040+.00038*rng.random(count))*age
    # Merge barycentric root weights before keeping the four strongest joints.
    root_ids=np.zeros((count,4),dtype=np.uint16)
    root_weights=np.zeros((count,4),dtype=float)
    slots=int(np.max(joints))+1
    merged=np.zeros((count,slots))
    for corner in range(3):
        for influence in range(4):
            np.add.at(merged,(np.arange(count),joints[corners[:,corner],influence].astype(int)),
                      bary[:,corner]*weights[corners[:,corner],influence])
    root_ids[:]=np.argsort(merged,axis=1)[:,-4:]
    root_weights[:]=np.take_along_axis(merged,root_ids,axis=1)
    root_weights/=root_weights.sum(1,keepdims=True)
    root_uv=interpolate(uv)
    root_colors=interpolate(colors)
    variation=(.94+.12*rng.random(count))[:,None]
    root_colors[:,:3]=np.clip(root_colors[:,:3]*variation,0,1)
    if detailed:
        return build_cards(roots,n,tangent,sideways,sizes,root_uv,root_colors,root_ids,
                           root_weights,source_roots,corners,bary,age,length)
    if shaggy:
        return gravity_strands(roots,n,tangent,sideways,sizes,root_uv,root_colors,root_ids,
                               root_weights,source_roots,corners,bary,age,length,detailed)
    direction=unit(n*.48+tangent*.87)
    across=unit(np.cross(direction,sideways))
    phase=rng.uniform(0,2*np.pi,count)
    angles=phase[:,None]+np.arange(3)[None,:]*2*np.pi/3
    middle=roots+(n*(.42-.12*head)[:,None]+tangent*.39)*sizes[:,None]
    tip=roots+(n*(.48-.30*head)[:,None]+tangent*.86)*sizes[:,None]
    tip+=sideways*(rng.uniform(-.06,.06,count)*sizes)[:,None]
    branches=((0.,1.,1.),)
    vertices=[];normals_out=[];colours=[];all_radii=[];faces=[]
    for branch,(fan,length_scale,width_scale) in enumerate(branches):
        branch_radii=radii*width_scale
        a=angles+branch*.7
        radial=sideways[:,None,:]*np.cos(a)[:,:,None]+across[:,None,:]*np.sin(a)[:,:,None]
        root=roots-n*(branch_radii*.35)[:,None]
        bend=roots+(middle-roots)*length_scale+sideways*(sizes*fan*.45)[:,None]
        end=roots+(tip-roots)*length_scale+sideways*(sizes*fan)[:,None]
        points=np.concatenate([root[:,None,:]+radial*branch_radii[:,None,None],
                               bend[:,None,:]+radial*(branch_radii*.48)[:,None,None],end[:,None,:]],axis=1)
        blend=.25 if shaggy else .15
        ring_normals=unit(n[:,None,:]*(1-blend)+radial*blend)
        strand_normals=np.concatenate([ring_normals,ring_normals,n[:,None,:]],axis=1)
        index=(np.arange(count)[:,None]+branch*count)*7
        for side in range(3):
            other=(side+1)%3
            for face in ([side,other,side+3],[other,other+3,side+3],[side+3,other+3,6]):
                faces.append(index+np.array(face))
        vertices.append(points.reshape(-1,3));normals_out.append(strand_normals.reshape(-1,3))
        colours.append(np.repeat(root_colors,7,axis=0));all_radii.append(branch_radii)
    copies=len(branches)
    def repeated(values):
        return np.tile(np.repeat(values,7,axis=0),(copies,1))
    return dict(positions=np.concatenate(vertices),normals=np.concatenate(normals_out),
                uv=repeated(root_uv),colors=np.concatenate(colours),
                joints=repeated(root_ids),weights=repeated(root_weights),
                source=repeated(source_roots),indices=np.concatenate(faces).reshape(-1),
                roots=np.tile(roots,(copies,1)),root_faces=np.tile(corners,(copies,1)),
                root_barycentric=np.tile(bary,(copies,1)),radii=np.concatenate(all_radii),
                tuft_count=count,strand_count=count*copies,length=length,element_vertices=7,
                method='rooted_three_strand_tufts' if shaggy else 'individual_tapered_tubes')
