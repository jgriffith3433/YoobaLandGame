#!/usr/bin/env python3
"""Builds site/map/: places.json, img/*.webp, audio/*.ogg and map.svg.
Sources (not committed): YoobaLand Resources/YoobaLoading/*.png and World/Common/Audio/*Ambience.mp3
in SRC (default /tmp/src, named like Glass-garden.png / WindyHilltop.mp3); site gallery images in images/.
Needs ffmpeg. World coords: x -900..1850, z -900..1100 (z up = north)."""
import json, os, subprocess, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/src"
OUT = "site/map"
S = 0.4
W, H = int((1850 + 900) * S), int((1100 + 900) * S)
def px(x, z): return round((x + 900) * S), round((1100 - z) * S)

# id, name, kind, chapter, [x,z], hook, image, ambient bed
P = [
 ("yooba-town", "Yooba Town", "chapter", 1, (0, 140), "A town full of Yoobas, and a clock that ticks like a friendly tummy.", "home.png", "FlowerMeadow", 0),
 ("seedvale", "Seedvale", "chapter", 2, (0, -300), "Golden rows, a red barn and a very slow windmill.", "seeds.png", "FlowerMeadow", 5),
 ("whistling-hills", "Whistling Hills", "chapter", 3, (-400, 100), "The wind plays the rocks like a flute.", "windy-night.png", "WindyHilltop", 0),
 ("crumblecrown", "Crumblecrown Castle", "chapter", 4, (-500, 850), "A castle on a hill, mid-crumble, and very polite about it.", "first-clue.png", "BoulderCanyon", 0),
 ("mistwood", "Mistwood Forest", "chapter", 5, (100, 700), "Giant trees, paper lanterns and a lot of mist.", "shot-orchard.jpg", "WhisperingForest", 6),
 ("sugarsand", "Sugarsand Coast", "chapter", 6, (700, -300), "A port, a lighthouse and a lot of sea.", "apples.png", "FlowerMeadow", 9),
 ("frostcap", "Frostcap Peak", "chapter", 7, (850, 950), "The highest place. The bell waits at the top.", "glass-garden.png", "WindyHilltop", 8),
 ("licorice-reach", "Licorice Reach", "chapter", 8, (1780, -480), "Always dusk. One orb left to eat.", "eight-orbs.png", "GlowcapGrove", 6),
 ("whispering-forest", "Whispering Forest", "biome", None, (-740, 530), "The big tree is humming. It is saying my name. Quietly.", "shot-orchard.jpg", "WhisperingForest", 0),
 ("bramble-thicket", "Bramble Thicket", "biome", None, (-640, 530), "A whole arch made of brambles! I'll go through slowly.", "shot-bridge.jpg", "BrambleThicket", 0),
 ("mossy-ruins", "Mossy Ruins", "biome", None, (340, 500), "One arch still stands up straight. It has been waiting a very long time.", "gallery-4.jpg", "MossyRuins", 0),
 ("flower-meadow", "Flower Meadow", "biome", None, (440, 500), "A sunflower taller than the windmill! It turns to look at me.", "apples.png", "FlowerMeadow", 0),
 ("glowcap-grove", "Glowcap Grove", "biome", None, (290, 660), "The biggest mushroom in the world, glowing softly, just for me.", "gallery-5.jpg", "GlowcapGrove", 0),
 ("boulder-canyon", "Boulder Canyon", "biome", None, (-640, 1025), "A tower of rock, stacked like pancakes. Somebody very patient made this.", "first-clue.png", "BoulderCanyon", 4),
 ("reed-marsh", "Reed Marsh", "biome", None, (-510, -570), "A heron on one leg on a very tall post. We are both being very still.", "shot-market.jpg", "ReedMarsh", 0),
 ("windy-hilltop", "Windy Hilltop", "biome", None, (-375, 380), "Stones in a ring on top of the world. The wind almost says words.", "windy-night.png", "WindyHilltop", 3),
 ("glimmer-lake", "Glimmer Lake", "water", None, (-300, -420), "Sit still. The fish don't hurry, and neither does the lake.", "seeds.png", "ReedMarsh", 6),
 ("willow-water", "Willow Water", "water", None, (265, -322), "Seventeen lily pads. Count them in order.", "shot-bridge.jpg", "ReedMarsh", 11),
]
LABEL = {  # label offset (dx, dy) in map px, anchor
 "yooba-town": (0, 30), "seedvale": (0, 34), "whispering-forest": (-8, -14), "bramble-thicket": (14, 22),
 "mossy-ruins": (-10, 22), "flower-meadow": (20, 22), "glowcap-grove": (-34, -2), "reed-marsh": (0, -14),
 "windy-hilltop": (14, -4), "glimmer-lake": (0, 24), "willow-water": (0, -14), "whistling-hills": (0, 30),
 "crumblecrown": (30, -2), "mistwood": (-6, -34), "sugarsand": (0, 34), "frostcap": (0, -26),
 "licorice-reach": (-6, 30), "boulder-canyon": (14, 6),
}

def run(*a): subprocess.run(a, check=True, capture_output=True)
os.makedirs(OUT + "/img", exist_ok=True); os.makedirs(OUT + "/audio", exist_ok=True)

def find(n):
    for p in (f"{SRC}/{n}", f"images/{n}", f"store/{n}"):
        if os.path.exists(p): return p
    raise SystemExit("missing " + n)
for n in {p[6] for p in P}:
    out = f"{OUT}/img/{os.path.splitext(n)[0]}.webp"
    for q in (74, 62, 50, 40):
        run("ffmpeg", "-y", "-loglevel", "error", "-i", find(n), "-vf", "scale=640:-2", "-c:v", "libwebp", "-quality", str(q), out)
        if os.path.getsize(out) < 120000: break
for bed in {p[7] for p in P}:
    for ss in {p[8] for p in P if p[7] == bed}:
        out = f"{OUT}/audio/{bed}-{ss}.ogg"
        run("ffmpeg", "-y", "-loglevel", "error", "-ss", str(ss), "-t", "9", "-i", find(bed + ".mp3"), "-ac", "1", "-ar", "32000",
            "-af", "afade=t=in:d=0.5,afade=t=out:st=8.5:d=0.5", "-c:a", "libvorbis", "-b:a", "40k", out)

places = []
for id, name, kind, ch, (x, z), hook, img, bed, ss in P:
    mx, my = px(x, z)
    d = {"id": id, "name": name, "kind": kind, "world": [x, z], "map": [mx, my], "hook": hook,
         "image": f"img/{os.path.splitext(img)[0]}.webp", "ambient": f"audio/{bed}-{ss}.ogg"}
    if ch: d["chapter"] = ch
    places.append(d)
json.dump({"_about": "Map content. map = SVG px (viewBox %dx%d), world = metres (x -900..1850, z -900..1100). Built by tools/build-map.py." % (W, H),
           "viewBox": [W, H], "places": places}, open(OUT + "/places.json", "w"), indent=1)

# SVG
by = {p["id"]: p for p in places}
road = [by[i]["map"] for i in ("yooba-town", "seedvale", "whistling-hills", "crumblecrown", "mistwood", "sugarsand", "frostcap", "licorice-reach")]
# Road Home: smooth curve through the 8 chapters
def curve(pts):
    s = f"M{pts[0][0]},{pts[0][1]}"
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        s += f" Q{a[0] + (b[0] - a[0]) * .2:.0f},{b[1] + (a[1] - b[1]) * .3:.0f} {mx:.0f},{my:.0f} T{b[0]},{b[1]}"
    return s
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="mt md" font-family="\'Patrick Hand\',\'Comic Sans MS\',cursive,sans-serif">',
 '<title id="mt">Map of Yooba Land</title><desc id="md">The island of Yooba Land with its towns, forests, lakes and the dotted Road Home.</desc>',
 '<defs><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter></defs>',
 f'<rect width="{W}" height="{H}" fill="#7fd6e8"/>']
# land: hand-wobbled blob around the island
land = "M70,160 C120,60 330,40 470,70 C640,30 880,60 1020,150 C1090,300 1080,520 1010,640 C930,760 760,780 640,740 C520,780 330,770 200,720 C100,640 40,400 70,160Z"
svg += [f'<g filter="url(#rough)"><path d="{land}" fill="#f2d48a" stroke="#b58a3c" stroke-width="5"/>',
 '<path d="M110,170 C150,90 330,75 470,100 C630,65 860,95 985,170 C1040,300 1035,500 975,610 C900,715 760,730 640,700 C520,735 340,725 230,690 C140,620 90,400 110,170Z" fill="#a8d672"/></g>']
# water
for id in ("glimmer-lake", "willow-water"):
    x, y = by[id]["map"]
    svg.append(f'<ellipse cx="{x}" cy="{y}" rx="{40 if id=="glimmer-lake" else 26}" ry="{26 if id=="glimmer-lake" else 16}" fill="#7fd6e8" stroke="#3fa7c9" stroke-width="3"/>')
svg.append('<path d="M370,540 C380,470 350,410 330,380 M290,420 C310,330 340,300 380,250" fill="none" stroke="#3fa7c9" stroke-width="3" stroke-linecap="round" opacity=".8"/>')
# icy lake, sea label
svg.append('<ellipse cx="%d" cy="%d" rx="22" ry="14" fill="#dff1ff" stroke="#6c8fc4" stroke-width="3"/>' % px(680, 780))
svg.append('<text x="940" y="350" font-size="22" fill="#2f7f9b" font-style="italic" text-anchor="middle">Sugarsand Sea</text>')
# biome patches
col = {"whispering-forest": "#3f8f6a", "bramble-thicket": "#8a4f6a", "mossy-ruins": "#7a9a6a", "flower-meadow": "#f2b84a",
       "glowcap-grove": "#5ac7d8", "boulder-canyon": "#c4704a", "reed-marsh": "#b9a24a", "windy-hilltop": "#cfe6a8"}
for id, c in col.items():
    x, y = by[id]["map"]
    svg.append(f'<circle cx="{x}" cy="{y}" r="22" fill="{c}" opacity=".55" stroke="{c}" stroke-width="3" stroke-dasharray="2 5"/>')
# Road Home
svg.append(f'<path id="road-home" d="{curve(road)}" fill="none" stroke="#c4503f" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 12"/>')
# places
for p in places:
    x, y = p["map"]
    dx, dy = LABEL[p["id"]]
    ch = p.get("chapter")
    anchor = "start" if dx > 18 else "end" if dx < -18 else "middle"
    tx = x + dx + (6 if anchor == "start" else -6 if anchor == "end" else 0)
    size = 21 if ch else 15
    svg.append(f'<g class="place" data-place="{p["id"]}" tabindex="0" role="button" aria-label="{p["name"]}" style="cursor:pointer">')
    if ch:
        svg.append(f'<circle cx="{x}" cy="{y}" r="15" fill="#fff6d8" stroke="#c4503f" stroke-width="4"/><text x="{x}" y="{y+6}" font-size="18" font-weight="bold" text-anchor="middle" fill="#7a2f22">{ch}</text>')
    else:
        svg.append(f'<circle cx="{x}" cy="{y}" r="6" fill="#fff6d8" stroke="#3a3a2a" stroke-width="3"/>')
    svg.append(f'<text x="{tx}" y="{y+dy}" font-size="{size}" text-anchor="{anchor}" fill="#3a2a14" stroke="#fff6d8" stroke-width="4" paint-order="stroke">{p["name"]}</text></g>')
svg.append(f'<text x="{W-24}" y="{H-24}" font-size="34" text-anchor="end" fill="#7a2f22">Yooba Land</text>')
svg.append("</svg>")
open(OUT + "/map.svg", "w").write("\n".join(svg))
