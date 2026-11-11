# Lector mínimo de Parquet (sólo lo que usa este dataset): ZSTD/sin compresión, PLAIN y RLE_DICTIONARY,
# páginas de datos v1 y v2, columnas BYTE_ARRAY / INT32 opcionales sin repetición.
import struct, ctypes
from thrift import R
_z = ctypes.CDLL('libzstd.so.1')
_z.ZSTD_decompress.restype = ctypes.c_size_t
_z.ZSTD_decompress.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t]
_z.ZSTD_isError.argtypes = [ctypes.c_size_t]
def unzstd(src, n):
    dst = ctypes.create_string_buffer(n)
    r = _z.ZSTD_decompress(dst, n, src, len(src))
    if _z.ZSTD_isError(r): raise ValueError('zstd')
    return dst.raw[:r]
def decomp(codec, src, n):
    if codec == 0: return src
    if codec == 6: return unzstd(src, n)
    raise ValueError('codec %d' % codec)

def hybrid(b, p, bw, count):
    """RLE / bit-packed hybrid → lista de enteros (lee hasta `count`)."""
    out = []
    while len(out) < count and p < len(b):
        h = 0; sh = 0
        while True:
            x = b[p]; p += 1; h |= (x & 0x7f) << sh; sh += 7
            if not x & 0x80: break
        if h & 1:
            groups = h >> 1; nbytes = groups * bw
            chunk = int.from_bytes(b[p:p + nbytes], 'little'); p += nbytes
            mask = (1 << bw) - 1 if bw else 0
            for i in range(groups * 8): out.append((chunk >> (i * bw)) & mask if bw else 0)
        else:
            run = h >> 1; w = (bw + 7) // 8
            v = int.from_bytes(b[p:p + w], 'little'); p += w
            out.extend([v] * run)
    return out[:count], p

def plain(b, ptype, n):
    out = []; p = 0
    if ptype == 6:  # BYTE_ARRAY
        for _ in range(n):
            ln = struct.unpack_from('<I', b, p)[0]; p += 4; out.append(b[p:p + ln]); p += ln
    elif ptype == 1:  # INT32
        out = list(struct.unpack_from('<%di' % n, b, 0))
    else: raise ValueError('tipo %d' % ptype)
    return out

def read_column(buf, md, ptype, maxdef):
    codec = md[4]; start = md.get(11) if md.get(11) is not None else md[9]; end = start + md[7]
    p = start; dictv = None; values = []
    while p < end:
        r = R(buf, p); ph = r.struct(); p = r.p
        csize = ph[3]; usize = ph[2]; raw = buf[p:p + csize]; p += csize
        t = ph[1]
        if t == 2:  # diccionario
            dictv = plain(decomp(codec, raw, usize), ptype, ph[7][1]); continue
        if t == 0:
            dh = ph[5]; nv = dh[1]; enc = dh[2]; data = decomp(codec, raw, usize); q = 0
            if maxdef:
                ln = struct.unpack_from('<I', data, 0)[0]; defs, _ = hybrid(data, 4, maxdef.bit_length(), nv); q = 4 + ln
            else: defs = [0] * nv
        elif t == 3:
            dh = ph[8]; nv = dh[1]; enc = dh[4]; dl = dh[5]; rl = dh[6]
            lv = raw[:rl + dl]; body = raw[rl + dl:]
            body = decomp(codec, body, usize - rl - dl) if dh.get(7, True) else body
            defs = hybrid(lv, rl, maxdef.bit_length(), nv)[0] if maxdef else [0] * nv
            data = body; q = 0
        else: continue
        present = sum(1 for d in defs if d == maxdef)
        if enc in (8, 2):
            bw = data[q]; idx, _ = hybrid(data, q + 1, bw, present); vals = [dictv[i] for i in idx]
        else: vals = plain(data[q:], ptype, present)
        it = iter(vals)
        values.extend(next(it) if d == maxdef else None for d in defs)
    return values

def read(path):
    """→ dict columna → lista, con 'image', 'caption', 'subject', 'row_id'."""
    buf = open(path, 'rb').read()
    n = struct.unpack('<I', buf[-8:-4])[0]; meta = R(buf[-8 - n:-8]).struct()
    types = {'image.bytes': (6, 2), 'image.path': (6, 2), 'caption': (6, 1), 'subject': (6, 1), 'row_id': (1, 1)}
    cols = {k: [] for k in types}
    for rg in meta[4]:
        for c in rg[1]:
            md = c[3]; name = '.'.join(x.decode() for x in md[3])
            if name not in types: continue
            pt, mx = types[name]
            cols[name].extend(read_column(buf, md, pt, mx))
    return {'image': cols['image.bytes'], 'caption': [x.decode() if x else '' for x in cols['caption']], 'subject': [x.decode() if x else '' for x in cols['subject']], 'row_id': cols['row_id']}
