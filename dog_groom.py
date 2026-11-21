"""Anatomical groom fields in the original Labrador surface coordinates.

The detailed groom deliberately keeps facial hair short and builds volume at
the ruff, breast, leg feathering and tail. It is independent of photo lighting.
"""
import numpy as np
from dog_shape import smooth


def detailed_groom(cfg):
    return cfg.get('groom_quality',1)>=2


def groom_regions(points):
    x,y,z=np.asarray(points).T
    head=smooth(.95,1.12,y)*smooth(.38,.60,z)
    face=smooth(.55,.76,z)*smooth(.77,1.0,y)
    neck=smooth(.12,.34,z)*(1-smooth(.51,.66,z))*smooth(.62,.91,y)
    breast=smooth(.26,.40,z)*(1-smooth(.53,.69,z))*smooth(.30,.52,y)*(1-smooth(.93,1.08,y))
    tail=(1-smooth(.05,.10,abs(x-.02)))*smooth(.52,.72,-z)
    feather=smooth(.17,.32,y)*(1-smooth(.51,.69,y))*smooth(.09,.15,abs(x))
    return dict(head=head,face=face,neck=neck,breast=breast,tail=tail,feather=feather)


def guide_flow(points,regions):
    """Coherent comb direction: back along the spine, down the ruff/flanks."""
    x,y,z=np.asarray(points).T
    top=smooth(.78,1.04,y)*(1-regions['head'])*(1-regions['breast'])
    comb=np.c_[np.sign(x)*(.08+.12*top),-1.+.65*top,-.25-.75*top]
    # Shallow guide waves are shared by neighbouring roots, not random spikes.
    comb[:,0]+=.09*np.sin(z*27.+y*13.)
    comb[:,2]+=.08*np.sin(y*31.+x*9.)
    comb[:,2]-=.4*regions['head']
    return comb*(1-regions['tail'][:,None])+np.array([0.,-.90,-.42])*regions['tail'][:,None]


def region_lengths(regions):
    body=(.72+1.35*regions['neck']+1.65*regions['breast']+
          .90*regions['feather']+2.1*regions['tail'])
    # No long locks above the eyes or across the mouth.
    return body*(1-.94*regions['face'])*(1-.78*regions['head'])
