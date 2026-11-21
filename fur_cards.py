"""Rooted curved hair clusters for the opt-in detailed game groom.

Each narrow card carries twelve individually tapered fibres. The atlas is
procedural, neutral and deterministic; no photograph/background is baked in.
"""
import numpy as np
from dog_groom import groom_regions

FIBRES_PER_CARD=12


def fibre_atlas():
    tiles=8;width=128;height=512
    rng=np.random.default_rng(6321)
    x=(np.arange(width)+.5)/width
    y=(np.arange(height)+.5)/height
    atlas=np.zeros((height,tiles*width,4),dtype=np.float32)
    atlas[:,:,:3]=1.
    for tile in range(tiles):
        alpha=np.zeros((height,width));shade=np.zeros_like(alpha)
        for fibre in range(FIBRES_PER_CARD):
            root=(fibre+.5+rng.uniform(-.15,.15))/FIBRES_PER_CARD
            end=rng.uniform(.78,.99)
            t=y[:,None]/end
            curve=root+np.sin(t*np.pi*.8)*rng.uniform(-.025,.025)
            curve+=t*t*rng.uniform(-.025,.025)
            sigma=rng.uniform(.009,.017)*np.sqrt(np.maximum(1-t,0.))+.001
            distance=(x[None,:]-curve)/sigma
            strand=np.exp(-.5*distance*distance)*np.clip((1-t)*35,0,1)
            alpha=np.maximum(alpha,strand)
            # Gentle cylindrical tonal variation makes each fibre readable
            # under diffuse light; the PBR shader supplies actual highlights.
            shade=np.maximum(shade,strand*(.83+.13*np.exp(-distance*distance*.8)))
        color=np.where(alpha>.01,shade/np.maximum(alpha,.01),1.)
        atlas[:,tile*width:(tile+1)*width,:3]=color[:,:,None]
        atlas[:,tile*width:(tile+1)*width,3]=alpha
    return atlas


def build_cards(roots,n,tangent,sideways,sizes,root_uv,root_colors,root_ids,
                root_weights,source_roots,corners,bary,age,length):
    count=len(roots);rows=5;vertices=rows*3
    t=np.array([0.,.20,.44,.71,1.])
    regions=groom_regions(source_roots)
    width=np.clip(sizes*.11,.0022,.0070)*age
    loft=.10+.12*np.maximum(regions['neck'],regions['breast'])
    sag=.22*(1-np.maximum(n[:,1],0.)**2)
    gravity=np.array([0.,-1.,0.])
    centers=(roots[:,None,:]+tangent[:,None,:]*(sizes[:,None]*.91*t)[:,:,None]
             +n[:,None,:]*(sizes[:,None]*loft[:,None]*np.sin(np.pi*.8*t)-width[:,None]*.05)[:,:,None]
             +gravity*(sizes[:,None]*sag[:,None]*t*t)[:,:,None])
    flow=tangent[:,None,:]*.91+n[:,None,:]*(loft[:,None]*np.pi*.8*np.cos(np.pi*.8*t))[:,:,None]
    flow+=gravity*(2*sag[:,None]*t)[:,:,None]
    flow/=np.maximum(np.linalg.norm(flow,axis=-1,keepdims=True),1e-12)
    normal=np.cross(flow,sideways[:,None,:])
    normal/=np.maximum(np.linalg.norm(normal,axis=-1,keepdims=True),1e-12)
    span=width[:,None]*(1-.90*t**1.2)
    across=np.array([-1.,0.,1.])
    points=centers[:,:,None,:]+sideways[:,None,None,:]*(span[:,:,None]*across)[:,:,:,None]
    # A very shallow center ridge avoids an entirely planar highlight.
    points[:,:,1]+=normal*(span*.06)[:,:,None]
    normals=normal[:,:,None,:]+sideways[:,None,None,:]*across[None,None,:,None]*.10
    normals/=np.maximum(np.linalg.norm(normals,axis=-1,keepdims=True),1e-12)
    tangents=np.repeat(flow[:,:,None,:],3,axis=2)
    tangents-=normals*np.sum(normals*tangents,axis=-1,keepdims=True)
    tangents/=np.maximum(np.linalg.norm(tangents,axis=-1,keepdims=True),1e-12)
    tangents=np.concatenate([tangents,np.ones((*tangents.shape[:-1],1))],axis=-1)
    tile=np.arange(count)%8
    uv=np.empty((count,rows,3,2))
    uv[:,:,:,0]=(tile[:,None,None]+np.array([.015,.5,.985])[None,None,:])/8
    uv[:,:,:,1]=t[None,:,None]
    offsets=np.arange(count)[:,None]*vertices
    indices=[]
    for row in range(rows-1):
        for column in range(2):
            a=row*3+column;b=a+1;c=a+3;d=c+1
            indices.extend([offsets+np.array([a,c,b]),offsets+np.array([b,c,d])])
    def repeat(values):return np.repeat(values,vertices,axis=0)
    return dict(positions=points.reshape(-1,3),normals=normals.reshape(-1,3),
                tangents=tangents.reshape(-1,4),uv=uv.reshape(-1,2),colors=repeat(root_colors),
                root_texture_uv=repeat(root_uv),
                joints=repeat(root_ids),weights=repeat(root_weights),source=repeat(source_roots),
                indices=np.concatenate(indices).reshape(-1),roots=roots,root_faces=corners,
                root_barycentric=bary,radii=width,tuft_count=count,
                strand_count=count*FIBRES_PER_CARD,length=length,element_vertices=vertices,
                method='layered_anatomical_cards',alpha_atlas=fibre_atlas())
