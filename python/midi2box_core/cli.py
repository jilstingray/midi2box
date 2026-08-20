import argparse
import base64
import json
import sys

from .conversion import convert_midi_bytes
from .renderers import export_payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Standard MIDI files to 30-note music box paper tape sheets.")
    parser.add_argument("--format", choices=["json", "svg", "pdf"], default="json")
    args = parser.parse_args()

    try:
        request = json.load(sys.stdin)
        raw = base64.b64decode(request["data_base64"])
        result = convert_midi_bytes(raw, request.get("options", {}), request.get("filename", "untitled.mid"))
        result["exportOptions"] = export_options(request.get("options", {}))
        print(json.dumps(export_payload(result, args.format), ensure_ascii=False))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


def export_options(options: dict) -> dict:
    title = str(options.get("title") or "").strip()
    font_family = str(options.get("exportFontFamily") or "Helvetica").strip()
    try:
        font_size = int(options.get("exportFontSize", 8))
    except (TypeError, ValueError):
        font_size = 8
    paper_size = str(options.get("exportPaperSize") or "A4").strip()
    try:
        tape_columns = int(options.get("exportTapeColumns", 2))
    except (TypeError, ValueError):
        tape_columns = 2
    return {
        "title": title,
        "exportFontFamily": font_family,
        "exportFontSize": min(16, max(5, font_size)),
        "exportShowPitch": bool(options.get("exportShowPitch", True)),
        "exportShowMeasures": bool(options.get("exportShowMeasures", True)),
        "exportPaperSize": paper_size,
        "exportOrientation": "portrait",
        "exportTapeColumns": min(8, max(1, tape_columns)),
    }
