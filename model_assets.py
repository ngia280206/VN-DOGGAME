"""Binary glTF metadata and offline mesh access, independent of the viewer."""
from functools import lru_cache
import copy
import json
from pathlib import Path
import struct

import numpy as np


SOURCE = Path(__file__).resolve().parent / 'Textures/GLB/Labrador_AllAnimations.glb'


def read_document(path):
    """Read only the JSON chunk; cache metadata without retaining large meshes."""
    path = Path(path).resolve()
    stat = path.stat()
    return _read_document(path, stat.st_mtime_ns, stat.st_size)


@lru_cache(maxsize=64)
def _read_document(path, modified, size):
    with path.open('rb') as stream:
        header = stream.read(20)
        if len(header) != 20:
            raise ValueError(f'Truncated GLB header: {path}')
        magic, version, length, json_length, kind = struct.unpack('<4sIII4s', header)
        if magic != b'glTF' or version != 2 or kind != b'JSON':
            raise ValueError(f'Expected binary glTF 2 with a JSON chunk: {path}')
        if length != size or json_length > size - 20 or json_length % 4:
            raise ValueError(f'Invalid GLB length: {path}')
        return json.loads(stream.read(json_length))


def _rotation(quaternion):
    x, y, z, w = np.asarray(quaternion, dtype=float) / np.linalg.norm(quaternion)
    return np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
    ])


class GLB:
    def __init__(self, path):
        self.doc = copy.deepcopy(read_document(path))
        raw = Path(path).read_bytes()
        size = struct.unpack_from('<I', raw, 12)[0]
        offset = 20 + size
        if offset + 8 > len(raw):
            raise ValueError(f'Missing GLB binary chunk: {path}')
        binary_size, kind = struct.unpack_from('<I4s', raw, offset)
        if kind != b'BIN\0' or offset + 8 + binary_size != len(raw):
            raise ValueError(f'Invalid GLB binary chunk: {path}')
        self.binary = bytearray(raw[offset + 8:])
        self.parents = {c: i for i, n in enumerate(self.doc['nodes']) for c in n.get('children', [])}
        self.names = {n.get('name'): i for i, n in enumerate(self.doc['nodes'])}
        self.world = {}
        for i in range(len(self.doc['nodes'])):
            self._world(i)

    def _world(self, i):
        if i not in self.world:
            n = self.doc['nodes'][i]
            if 'matrix' in n:
                m = np.asarray(n['matrix']).reshape(4, 4).T.copy()
            else:
                m = np.eye(4)
                m[:3, :3] = _rotation(n.get('rotation', [0, 0, 0, 1])) @ np.diag(n.get('scale', [1, 1, 1]))
                m[:3, 3] = n.get('translation', [0, 0, 0])
            self.world[i] = self._world(self.parents[i]) @ m if i in self.parents else m
        return self.world[i]

    def read(self, index):
        a = self.doc['accessors'][index]
        v = self.doc['bufferViews'][a['bufferView']]
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        dtype = np.dtype({5126: '<f4', 5123: '<u2', 5121: 'u1', 5125: '<u4'}[a['componentType']])
        return np.ndarray((a['count'], count), dtype=dtype, buffer=self.binary,
                          offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                          strides=(v.get('byteStride', count * dtype.itemsize), dtype.itemsize)).copy()

    def append(self, array, kind):
        a = np.asarray(array, dtype='<f4')
        self.binary.extend(b'\0' * (-len(self.binary) % 4))
        vi = len(self.doc['bufferViews'])
        self.doc['bufferViews'].append(dict(buffer=0, byteOffset=len(self.binary), byteLength=a.nbytes))
        self.binary.extend(a.tobytes())
        ai = len(self.doc['accessors'])
        acc = dict(bufferView=vi, componentType=5126, count=len(a), type=kind)
        if kind == 'VEC3':
            acc.update(min=a.min(0).tolist(), max=a.max(0).tolist())
        self.doc['accessors'].append(acc)
        return ai

    def write(self, path):
        self.binary.extend(b'\0' * (-len(self.binary) % 4))
        self.doc['buffers'][0]['byteLength'] = len(self.binary)
        data = json.dumps(self.doc, separators=(',', ':')).encode()
        data += b' ' * (-len(data) % 4)
        payload = (struct.pack('<4sII', b'glTF', 2, 28 + len(data) + len(self.binary))
                   + struct.pack('<I4s', len(data), b'JSON') + data
                   + struct.pack('<I4s', len(self.binary), b'BIN\0') + self.binary)
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix('.tmp')
        temp.write_bytes(payload)
        temp.replace(path)
