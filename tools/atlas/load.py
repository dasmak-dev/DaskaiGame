# Carga los .parquet de _dataset/ (o de $DASKAI_DATASET) en una lista de filas (archivo, row_id, subject, caption, png)
import pickle, os, glob, tempfile
from parquet import read
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.environ.get('DASKAI_DATASET', os.path.join(ROOT, '_dataset'))
F = sorted(glob.glob(os.path.join(DIR, '*.parquet')))
C = os.path.join(tempfile.gettempdir(), 'daskai-atlas.pkl')
def load():
    if os.path.exists(C): return pickle.load(open(C, 'rb'))
    rows = []
    for fi, f in enumerate(F):
        d = read(f)
        for i in range(len(d['row_id'])):
            if d['image'][i]: rows.append((fi, d['row_id'][i], d['subject'][i].lower(), d['caption'][i].lower(), d['image'][i]))
    pickle.dump(rows, open(C, 'wb')); return rows
