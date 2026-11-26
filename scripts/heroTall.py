"""Make the tall (phone and upright tablet) versions of the store's built-in hero illustrations.

Input:  public/assets/hero-<name>.svg (1600 x 720, products in the right-hand part).
Output: public/assets/hero-<name>-tall.svg. The viewBox is cropped to the products and the sky and floor are
        extended far past it, so in a frame of any shape the products are shown whole and centred (the SVG's own
        "meet" fitting) while the background fills the rest. Run again after editing a wide illustration:
        python3 scripts/heroTall.py
"""
import re
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / 'public' / 'assets'
BOX = '680 56 916 580'  # the area every illustration's products sit in: x y width height

for name in ['electronics', 'kitchen', 'cooling', 'entertainment', 'power']:
    svg = (ASSETS / f'hero-{name}.svg').read_text()
    svg = svg.replace('viewBox="0 0 1600 720" width="1600" height="720"', f'viewBox="{BOX}"')
    # Pin the sky gradient and glow to the original picture, so enlarging the rectangles does not shift colours.
    svg = svg.replace('<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
                      '<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="720">')
    svg = re.sub(r'<radialGradient id="glow" cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+">',
                 lambda m: f'<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="{float(m[1]) * 1600:.0f}" cy="{float(m[2]) * 720:.0f}" r="620">', svg)
    svg = svg.replace('<rect width="1600" height="720" fill=', '<rect x="-1000" y="-1500" width="3600" height="3700" fill=')
    # Floor: carry its edges on to the right and downwards.
    svg, n = re.subn(r'<path d="M560 (\d+) L1600 (\d+) L1600 720 L520 720 Z" fill="url\(#floor\)"',
                     lambda m: f'<path d="M560 {m[1]} L1600 {m[2]} L2600 {int(m[2]) - 29} L2600 2200 L60 2200 Z" fill="url(#floor)"', svg)
    assert n == 1, f'floor not found in {name}'
    svg = svg.replace('<!-- ', '<!-- Tall version made by scripts/heroTall.py (do not edit by hand). ', 1)
    (ASSETS / f'hero-{name}-tall.svg').write_text(svg)
    print('wrote', name)
