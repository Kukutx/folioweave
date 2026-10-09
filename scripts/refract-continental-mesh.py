"""Offline asset generation; Python + Shapely 2.1, neither is a site dependency.

Usage: python scripts/refract-continental-mesh.py /path/to/ne_110m_land.geojson
Source: Natural Earth v5.1.2, 110m physical land, public domain.
The seven masks are illustrative geographic groupings, not political borders.
"""
import hashlib
import json
import sys
import math
from pathlib import Path
from shapely import segmentize, voronoi_polygons
from shapely.geometry import shape, Polygon, MultiPoint
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_bytes()
land = unary_union([shape(f['geometry']) for f in json.loads(source)['features']]).buffer(0)
definitions = [
    ('antarctica', [0, -82], [[-180,-90],[180,-90],[180,-60],[-180,-60]]),
    ('north-america', [-100, 45], [[-168,90],[-30,90],[-30,12],[-60,12],[-77,8],[-83,8],[-90,0],[-180,0],[-180,50],[-168,60]]),
    ('south-america', [-60, -20], [[-90,12],[-30,12],[-30,-60],[-90,-60]]),
    ('africa', [18, 3], [[-30,-60],[60,-60],[60,10],[44,12],[34,28],[32,31],[25,33],[10,37.5],[-6,36],[-30,36]]),
    ('europe', [22, 54], [[-30,36],[-6,36],[10,37.5],[25,33],[32,31],[36,36],[42,42],[50,44],[60,55],[66,70],[66,90],[-30,90]]),
    ('oceania', [140, -26], [[110,-60],[180,-60],[180,0],[130,0],[130,-9],[110,-9]]),
    ('asia', [95, 40], [[-180,-90],[180,-90],[180,90],[-180,90]]),
]

def polygons(geometry):
    if geometry.geom_type == 'Polygon':
        yield geometry
    elif hasattr(geometry, 'geoms'):
        for part in geometry.geoms:
            yield from polygons(part)

def make_fragment(geometry, seed):
    vertices, lookup, contours = [], {}, []
    def index(coord):
        key = tuple(round(v, 4) for v in coord[:2])
        if key not in lookup:
            lookup[key] = len(vertices)
            vertices.append(key)
        return lookup[key]
    for polygon in polygons(geometry):
        for ring in [polygon.exterior, *polygon.interiors]:
            contours.append([index(c) for c in segmentize(ring, 3).coords])
    center = geometry.centroid
    return dict(seed=seed, pivot=[round(center.x,4),round(center.y,4)], vertices=vertices, contours=contours)

result = []
remaining = land
for name, pivot, mask in definitions:
    region = remaining.intersection(Polygon(mask)).simplify(.2, preserve_topology=True)
    remaining = remaining.difference(Polygon(mask))
    x0,y0,x1,y1 = region.bounds
    # Large, irregular fracture cells. Their boundaries, not country borders,
    # are the visible glass cuts; detailed triangles only curve each shard.
    seeds = []
    for row, y in enumerate(range(int(y0 // 22)*22-22, int(y1)+45, 22)):
        for col, x in enumerate(range(int(x0 // 25)*25-25, int(x1)+51, 25)):
            jitter = math.sin((row*31+col*17+7)*12.9898)
            seeds.append((x+(row%2)*12+4*jitter, y+5*math.cos((row*13+col*43)*.73)))
    cells = voronoi_polygons(MultiPoint(seeds), extend_to=region.envelope, ordered=True)
    fragments = []
    for seed, cell in zip(seeds, cells.geoms):
        geometry = region.intersection(cell)
        if geometry.area < .05:
            continue
        fragments.append(make_fragment(geometry, [round(v,4) for v in seed]))
    result.append(dict(id=name, pivot=pivot, mask=mask, fragments=fragments))

output = ROOT / 'src/components/refract/lib/continent-mesh.json'
output.write_text(json.dumps(result, separators=(',',':')) + '\n', encoding='utf8')
credit = dict(
    title='Geographic mirror fragments',
    source='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson',
    license='Public domain', licenseUrl='https://www.naturalearthdata.com/about/terms-of-use/',
    sourceSha256=hashlib.sha256(source).hexdigest(),
    output='src/components/refract/lib/continent-mesh.json', outputSha256=hashlib.sha256(output.read_bytes()).hexdigest(),
    method='Physical coastlines and geographic masks, deterministic irregular Voronoi fracture cells with 3-degree contour sampling. Shards retain geographic samples and return to the curved sphere; hidden hemispheres are clipped before projection.',
    generator='scripts/refract-continental-mesh.py',
)
(ROOT / 'public/templates/refract/continental-geography-credit.json').write_text(json.dumps(credit, indent=2)+'\n',encoding='utf8')
print(json.dumps([dict(id=r['id'], fragments=len(r['fragments']), vertices=sum(len(f['vertices']) for f in r['fragments'])) for r in result]))
