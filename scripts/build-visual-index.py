import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1]).resolve()
names = ['corpus.json', 'source-manifest.json', 'curated-headwords.json']
inputs = [(root / 'src' / 'data' / name).read_bytes() for name in names]
corpus, curated_sources, mappings = [json.loads(value) for value in inputs]
preferred = {item['order']: next(source for source in curated_sources if source['char'] == item['char']) for item in mappings}
records = {}
for entry in corpus['records']:
    source = preferred.get(entry['order'])
    if source:
        code, sha = source['sourceCode'], source['sha256']
        path = root / 'public' / source['image'].lstrip('/')
    else:
        example = entry['examples'][0]
        code, sha = example['code'], example['sha256']
        folder = 'glyph-' + code.lower().replace('.', '-')
        path = root / 'public' / 'glyph-sources' / 'sinica-corpus-20261031' / folder / 'image.png'
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != sha:
        raise ValueError(f'Source hash mismatch: {code}')
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
        paper = Image.new('RGBA', rgba.size, 'white')
        paper.alpha_composite(rgba)
        mask = paper.convert('L').point(lambda value: 255 if value < 160 else 0)
        bounds = mask.getbbox()
        if not bounds:
            raise ValueError(f'No visible ink: {code}')
        left, top, right, bottom = bounds
        records[str(entry['order'])] = [code, right - left, bottom - top]

output = {
    'inputDigest': hashlib.sha256(b''.join(inputs)).hexdigest(),
    'threshold': 160,
    'records': records,
}
path = root / 'src' / 'data' / 'visual-index.json'
path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Indexed {len(records)} unchanged source images; bounding boxes are navigation aids, not character classifications.')
