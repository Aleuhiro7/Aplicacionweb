import sys, os, importlib, subprocess, glob
from PIL import Image
mods = sys.argv[1:]
os.makedirs('svg', exist_ok=True)
for f in glob.glob('svg/*.svg'): os.remove(f)
ids = []
for m in mods:
    mod = importlib.import_module(m)
    for eid, fn in mod.EX.items():
        a, b = fn()
        open(f'svg/{eid}_0.svg', 'w').write(a); open(f'svg/{eid}_1.svg', 'w').write(b); ids.append(eid)
subprocess.run(['node', 'render.js', 'svg', 'png'], check=True)
# hoja de contacto
cols = 2; th = (360, 240)
sheet = Image.new('RGB', (cols * 2 * 180 + 10, ((len(ids) + cols - 1) // cols) * 125), 'white')
for i, eid in enumerate(ids):
    for k in (0, 1):
        im = Image.open(f'png/{eid}_{k}.png').resize((180, 120))
        sheet.paste(im, ((i % cols) * 370 + k * 180, (i // cols) * 125))
sheet.save('sheet.png'); print(len(ids), 'ejercicios')
