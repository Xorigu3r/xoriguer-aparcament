"""Copia tots els logos i icones dels projectes Xoriguer a Documents/LOGOS-XORIGUER.
Una subcarpeta per projecte; elimina duplicats exactes (mateix contingut)."""
import hashlib, shutil
from pathlib import Path

DOC = Path(r"C:/Users/Xorigu3r/Documents")
DEST = DOC / "LOGOS-XORIGUER"
EXT = {".png", ".ico", ".svg", ".jpg", ".jpeg", ".webp"}

FONTS = {
    "Xoriguer": ["Xoriguer-codi/logotip", "Xoriguer-codi/imatges"],
    "XoriguerAcobert": ["XoriguerAcobert-codi/logotip", "XoriguerAcobert-codi/imatges"],
    "PlaCardiac": ["PlaCardiac-codi/logotip", "pla-cardiac/icons"],
    "XoriguerPressio": ["XoriguerPressio-codi/assets", "xoriguer-pressio/icons"],
    "XoriguerBotifarra": ["XoriguerBotifarra/empaquetar/logo", "XoriguerBotifarra/img",
                          "XoriguerBotifarra/empaquetar/escriptori"],
    "XoriguerDomino": ["XoriguerDomino/empaquetar/logo", "XoriguerDomino/img",
                       "XoriguerDomino/empaquetar/escriptori"],
    "MenjarSa": ["menjar-sa/icons"],
    "Plans": ["plans/icones"],
    "XoriguerGasolina": ["xoriguer-gasolina/icons", "xoriguer-gasolina/eines"],
    "Web-xorigu3r.github.io": ["xorigu3r.github.io/img"],
    "XoriguerAparcament": ["XoriguerAparcament/icons"],
}
EXCLOU = {"marbre.jpg"}  # textures, no logos


def main():
    total = 0
    for projecte, carpetes in FONTS.items():
        vistos = set()
        sortida = DEST / projecte
        for c in carpetes:
            base = DOC / c
            if not base.exists():
                print("  (no existeix)", base); continue
            # només el primer nivell excepte a 'logotip', que té subcarpetes
            fitxers = base.rglob("*") if base.name == "logotip" else base.glob("*")
            for f in sorted(fitxers):
                if not f.is_file() or f.suffix.lower() not in EXT or f.name in EXCLOU:
                    continue
                if "www" in f.parts:
                    continue
                h = hashlib.sha1(f.read_bytes()).hexdigest()
                if h in vistos:
                    continue
                vistos.add(h)
                rel = f.relative_to(base)
                desti = sortida / rel
                if desti.exists():  # mateix nom, contingut diferent
                    desti = desti.with_name(f"{desti.stem}__{base.parent.name}{desti.suffix}")
                desti.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, desti)
                total += 1
        print(f"{projecte}: {len(vistos)} fitxers")
    print("Total:", total)


if __name__ == "__main__":
    main()
