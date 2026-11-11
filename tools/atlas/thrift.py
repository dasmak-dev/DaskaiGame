# Lector mínimo del protocolo Thrift Compact (metadatos de Parquet): devuelve dicts {id_campo: valor}
class R:
    def __init__(s, b, p=0): s.b=b; s.p=p
    def byte(s): v=s.b[s.p]; s.p+=1; return v
    def varint(s):
        r=sh=0
        while True:
            x=s.byte(); r|=(x&0x7f)<<sh; sh+=7
            if not x&0x80: return r
    def zz(s): v=s.varint(); return (v>>1)^-(v&1)
    def binary(s): n=s.varint(); v=s.b[s.p:s.p+n]; s.p+=n; return bytes(v)
    def value(s,t):
        if t in (1,2): return t==1
        if t==3: return s.zz() if False else int.from_bytes(bytes([s.byte()]),'little',signed=True)
        if t in (4,5,6): return s.zz()
        if t==7: import struct; v=struct.unpack('<d',s.b[s.p:s.p+8])[0]; s.p+=8; return v
        if t==8: return s.binary()
        if t in (9,10):
            h=s.byte(); n=h>>4; et=h&15
            if n==15: n=s.varint()
            return [s.value(et) for _ in range(n)]
        if t==12: return s.struct()
        raise ValueError('tipo %d'%t)
    def struct(s):
        out={}; last=0
        while True:
            h=s.byte()
            if h==0: return out
            t=h&15; d=h>>4
            fid=last+d if d else s.zz()
            last=fid
            out[fid]=s.value(t) if t not in (1,2) else (t==1)
