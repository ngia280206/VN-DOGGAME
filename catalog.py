"""Portable model metadata, shared by the desktop runtime and offline tools.

Importing the catalog does not load meshes, start jobs, or import Panda3D.
All asset paths are relative to the project root.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CATALOG=json.loads((ROOT/'dog_catalog.json').read_text())
DOGS=CATALOG['dogs']
CUSTOM_DOGS=json.loads((ROOT/'custom_catalog.json').read_text())['dogs']
AVAILABLE_DOGS=[*DOGS,*CUSTOM_DOGS]
TYPES=CATALOG['types']
BY_ID={dog['id']:dog for dog in DOGS}
AVAILABLE_BY_ID={dog['id']:dog for dog in AVAILABLE_DOGS}
TYPE_BY_ID={t['id']:t for t in TYPES}
AGE_STAGES={'adult':'Chó lớn','puppy':'Chó con','juvenile':'Chó nhỡ'}
STARTING_IDS=[d['id'] for d in DOGS if d['variant_id'] in ('normal','puppy','juvenile')]
_STARTING_DOGS={(d['type_id'],d['variant_id']):d for d in DOGS}

def starting_dog(type_id, age_stage='adult'):
    variant='normal' if age_stage=='adult' else age_stage
    return _STARTING_DOGS[type_id,variant]

def ear_cache_path(dog,style):
    import hashlib
    from dog_shape import GEOMETRY_VERSION
    from dog_fur import FUR_VERSION,is_shaggy_coat
    from dog_frames import ANATOMY_VERSION
    digest=hashlib.sha256(json.dumps(dog['profile'],sort_keys=True).encode()).hexdigest()[:10]
    coat=f'_f{FUR_VERSION}' if is_shaggy_coat(dog['profile']) else ''
    anatomy=f'_a{ANATOMY_VERSION}' if dog['profile'].get('anatomy_frame') else ''
    return ROOT/'assets'/'ear_cache'/f"{dog['id']}_{digest}_{style}_v{GEOMETRY_VERSION}{coat}{anatomy}.glb"
