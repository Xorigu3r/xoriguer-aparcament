"""Genera les icones PNG de Xoriguer Aparcament (falcó + cotxe + parquímetre).

Ús:  python eines/genera_icones.py   (des de l'arrel del projecte)
La geometria (en unitats d'un llenç de 512) és la mateixa que la de icons/logo.svg.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ARREL = Path(__file__).resolve().parent.parent
ICONS = ARREL / "icons"

FONS = (10, 11, 14, 255)       # #0A0B0E
CREMA = (246, 239, 226, 255)   # #F6EFE2
TARONJA = (255, 168, 46, 255)  # #FFA82E
TARONJA_FOSC = (242, 101, 15, 255)  # #F2650F

S = 4  # supermostreig


def q(p0, p1, p2, n=16):
    """Bézier quadràtica -> punts (sense p0)."""
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (i / n for i in range(1, n + 1))]


def cos_cotxe():
    p = [(70, 418), (70, 392)]
    p += q(p[-1], (72, 374), (94, 370))
    p += [(132, 364), (178, 330)]
    p += q(p[-1], (190, 322), (206, 322))
    p += [(278, 322)]
    p += q(p[-1], (296, 322), (308, 334))
    p += [(340, 364), (356, 367)]
    p += q(p[-1], (378, 372), (380, 394))
    p += [(380, 418)]
    return p


def finestra_darrere():
    p = [(180, 360), (202, 336)]
    p += q(p[-1], (206, 332), (214, 332))
    return p + [(250, 332), (250, 360)]


def finestra_davant():
    p = [(260, 332), (280, 332)]
    p += q(p[-1], (290, 332), (298, 340))
    return p + [(320, 360), (260, 360)]


def cap_parquimetre():
    p = [(398, 330), (398, 268)]
    # arc superior (semicercle centre 432,268 radi 34) d'esquerra a dreta
    p += [(432 + 34 * math.cos(a), 268 - 34 * math.sin(a))
          for a in (math.pi - math.pi * i / 32 for i in range(1, 33))]
    return p + [(466, 330)]


def degradat(mida, c1, c2):
    w, h = mida
    g = Image.new("RGBA", (w, 1))
    for x in range(w):
        t = x / max(1, w - 1)
        g.putpixel((x, 0), tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4)))
    return g.resize((w, h))


def dibuixa(mida_final, escala_contingut=1.0, amb_fons=True, rodo=False):
    N = 512 * S
    im = Image.new("RGBA", (N, N), FONS if amb_fons else (0, 0, 0, 0))
    capa = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    k = S

    def P(pts):
        return [(x * k, y * k) for x, y in pts]

    # Falcó
    falco = Image.open(ICONS / "falco.png").convert("RGBA")
    fw = 440 * k
    fh = round(fw * falco.height / falco.width)
    falco = falco.resize((fw, fh), Image.LANCZOS)
    capa.alpha_composite(falco, (36 * k, 66 * k))

    # Línies de velocitat
    for y, x0 in ((352, 24), (374, 12), (396, 30)):
        d.line([(x0 * k, y * k), (58 * k, y * k)], fill=TARONJA, width=6 * k)
        r = 3 * k
        d.ellipse([x0 * k - r, y * k - r, x0 * k + r, y * k + r], fill=TARONJA)

    # Terra
    d.line([(40 * k, 445 * k), (480 * k, 445 * k)], fill=(246, 239, 226, 90), width=3 * k)

    # Cos del cotxe amb degradat
    mask = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask).polygon(P(cos_cotxe()), fill=255)
    capa.paste(degradat((N, N), TARONJA_FOSC, TARONJA), (0, 0), mask)
    d.line(P(cos_cotxe() + [cos_cotxe()[0]]), fill=CREMA, width=5 * k, joint="curve")
    # Finestres
    for f in (finestra_darrere(), finestra_davant()):
        d.polygon(P(f), fill=FONS)
    # Far i pilot
    d.rounded_rectangle([368 * k, 378 * k, 378 * k, 386 * k], radius=2 * k, fill=CREMA)
    d.rounded_rectangle([72 * k, 378 * k, 80 * k, 388 * k], radius=2 * k, fill=(200, 40, 20, 255))
    # Rodes
    for cx in (128, 318):
        r = 26
        d.ellipse([(cx - r) * k, (418 - r) * k, (cx + r) * k, (418 + r) * k], fill=FONS, outline=CREMA, width=5 * k)
        r = 9
        d.ellipse([(cx - r) * k, (418 - r) * k, (cx + r) * k, (418 + r) * k], fill=TARONJA)

    # Parquímetre americà
    d.rounded_rectangle([425 * k, 330 * k, 439 * k, 436 * k], radius=3 * k, fill=CREMA)
    d.rounded_rectangle([410 * k, 434 * k, 454 * k, 444 * k], radius=3 * k, fill=CREMA)
    d.rounded_rectangle([414 * k, 326 * k, 450 * k, 338 * k], radius=3 * k, fill=CREMA)
    cap = cap_parquimetre()
    d.polygon(P(cap), fill=FONS)
    d.line(P(cap + [cap[0]]), fill=CREMA, width=5 * k, joint="curve")
    # Esfera
    cx, cy, r = 432, 278, 20
    d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=CREMA)
    d.pieslice([(cx - r + 3) * k, (cy - r + 3) * k, (cx + r - 3) * k, (cy + r - 3) * k], -60, 20, fill=TARONJA_FOSC)
    d.ellipse([(cx - 9) * k, (cy - 9) * k, (cx + 9) * k, (cy + 9) * k], fill=CREMA)
    a = math.radians(-130)
    d.line([(cx * k, cy * k), ((cx + 16 * math.cos(a)) * k, (cy + 16 * math.sin(a)) * k)], fill=FONS, width=3 * k)
    d.ellipse([(cx - 3) * k, (cy - 3) * k, (cx + 3) * k, (cy + 3) * k], fill=FONS)
    # Ranura de monedes
    d.rounded_rectangle([425 * k, 310 * k, 439 * k, 315 * k], radius=2 * k, fill=CREMA)

    if escala_contingut != 1.0:
        m = round(N * escala_contingut)
        petita = capa.resize((m, m), Image.LANCZOS)
        capa = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        capa.alpha_composite(petita, ((N - m) // 2, (N - m) // 2))
    im.alpha_composite(capa)

    if rodo:
        mk = Image.new("L", (N, N), 0)
        ImageDraw.Draw(mk).rounded_rectangle([0, 0, N - 1, N - 1], radius=N // 5, fill=255)
        im.putalpha(mk)
    return im.resize((mida_final, mida_final), Image.LANCZOS)


def logo_complet(mida=1024):
    im = Image.new("RGBA", (mida, mida), FONS)
    simbol = dibuixa(700, amb_fons=False)
    im.alpha_composite(simbol, ((mida - 700) // 2, 40))
    fonts = Path("C:/Windows/Fonts")
    f1 = ImageFont.truetype(str(fonts / "arialbi.ttf"), 132)
    f2 = ImageFont.truetype(str(fonts / "arialbd.ttf"), 54)
    d = ImageDraw.Draw(im)
    w = d.textlength("XORIGUER", font=f1)
    x = (mida - w) / 2
    d.text((x, 730), "X", font=f1, fill=TARONJA)
    d.text((x + d.textlength("X", font=f1), 730), "ORIGUER", font=f1, fill=CREMA)
    txt = "APARCAMENT"
    esp = 18
    total = sum(d.textlength(c, font=f2) for c in txt) + esp * (len(txt) - 1)
    x = (mida - total) / 2
    for c in txt:
        d.text((x, 890), c, font=f2, fill=TARONJA)
        x += d.textlength(c, font=f2) + esp
    return im


if __name__ == "__main__":
    dibuixa(512).save(ICONS / "icon-512.png")
    dibuixa(192).save(ICONS / "icon-192.png")
    dibuixa(512, escala_contingut=0.78).save(ICONS / "maskable-512.png")
    dibuixa(180, escala_contingut=0.92).save(ICONS / "apple-touch-icon.png")
    dibuixa(64, rodo=True).save(ICONS / "favicon.png")
    dibuixa(512, amb_fons=False).save(ICONS / "simbol.png")
    logo_complet().convert("RGB").save(ICONS / "logo-complet.png")
    print("Icones generades a", ICONS)
