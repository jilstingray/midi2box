from __future__ import annotations

import base64
import math
from typing import Any

from .music import note_name


def export_payload(result: dict[str, Any], output_format: str) -> dict[str, Any]:
    if output_format == "json":
        return {"kind": "json", "result": result}
    if output_format == "svg":
        return {"kind": "svg", "filename": "midi2box-sheet.svg", "content": sheet_svg(result)}
    if output_format == "pdf":
        return {
            "kind": "pdf",
            "filename": "midi2box-sheet.pdf",
            "contentBase64": base64.b64encode(pdf_bytes(result)).decode("ascii"),
        }
    raise ValueError(f"Unsupported export format: {output_format}")


def sheet_svg(result: dict[str, Any]) -> str:
    page_w, page_h = export_page_size(result)
    layout = export_layout(result, page_w, page_h)
    cols = int(layout["columns"])
    length_mm = max(float(result["paper"]["lengthMm"]), 1.0)
    segment_len = export_segment_length(result)
    segments = max(1, math.ceil(length_mm / segment_len))
    page_count = max(1, math.ceil(segments / cols))
    sheet_gap = layout["page_gap"]
    total_h = page_count * page_h + (page_count - 1) * sheet_gap
    font_family = escape(export_font_family(result))
    text_metrics = export_text_metrics(result, page_w)
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{page_w:.0f}mm" height="{total_h:.0f}mm" viewBox="0 0 {page_w:.2f} {total_h:.2f}">',
        '<rect width="100%" height="100%" fill="#f5f7fb"/>',
    ]
    for page in range(page_count):
        page_y = page * (page_h + sheet_gap)
        lines.append(f'<g transform="translate(0 {page_y:.2f})">')
        lines.append(f'<rect x="0" y="0" width="{page_w:.2f}" height="{page_h:.2f}" fill="#ffffff" stroke="#d1d5db" stroke-width="0.35"/>')
        for col in range(cols):
            segment_index = page * cols + col
            if segment_index >= segments:
                continue
            start_mm = segment_index * segment_len
            end_mm = min(length_mm, start_mm + segment_len)
            strip = strip_box(layout, col, segment_index == 0)
            lines.extend(draw_svg_tape_segment(result, strip["x"], strip["y"], strip["w"], strip["h"], start_mm, end_mm, segment_index + 1, segment_index == 0, font_family, text_metrics))
        lines.append("</g>")
    lines.append("</svg>")
    return "\n".join(lines)


def draw_svg_tape_segment(
    result: dict[str, Any],
    x0: float,
    y0: float,
    tape_w: float,
    tape_h: float,
    start_mm: float,
    end_mm: float,
    segment_number: int,
    show_title: bool,
    font_family: str,
    text_metrics: dict[str, float],
) -> list[str]:
    segment_len = max(end_mm - start_mm, 0.001)
    lane_w = tape_w / 30
    lines: list[str] = []
    if show_title:
        lines.append(f'<text x="{x0 + tape_w / 2:.2f}" y="{y0 + text_metrics["title_y"]:.2f}" text-anchor="middle" font-family="{font_family}" font-size="{text_metrics["title_size"]:.2f}" fill="#000000">{escape(export_title(result))}</text>')
    lines.append(f'<rect x="{x0:.2f}" y="{y0:.2f}" width="{tape_w:.2f}" height="{tape_h:.2f}" fill="#ffffff" stroke="#111111" stroke-width="0.35"/>')
    for i in range(31):
        x = x0 + i * lane_w
        lines.append(f'<line x1="{x:.2f}" y1="{y0:.2f}" x2="{x:.2f}" y2="{y0 + tape_h:.2f}" stroke="#c8c8c8" stroke-width="0.18"/>')
    if export_show_measures(result):
        first_mark = math.ceil(start_mm / 10) * 10
        for mm in range(int(first_mark), int(end_mm) + 1, 10):
            y = y0 + (mm - start_mm) / segment_len * tape_h
            stroke_w = "0.5" if mm % 50 == 0 else "0.3"
            lines.append(f'<line x1="{x0:.2f}" y1="{y:.2f}" x2="{x0 + tape_w:.2f}" y2="{y:.2f}" stroke="#000000" stroke-width="{stroke_w}"/>')
            if mm % 50 == 0:
                lines.append(f'<text x="{x0 + text_metrics["measure_x"]:.2f}" y="{y + text_metrics["measure_y"]:.2f}" font-family="{font_family}" font-size="{text_metrics["measure_size"]:.2f}" fill="#000000">{mm}</text>')
    if export_show_pitch(result):
        for row in label_rows(result):
            x = x0 + (row + 0.5) * lane_w
            pitch = int(result["paper"]["lowPitch"]) + row
            lines.append(f'<text x="{x:.2f}" y="{y0 + text_metrics["pitch_y"]:.2f}" text-anchor="middle" font-family="{font_family}" font-size="{text_metrics["pitch_size"]:.2f}" fill="#000000">{note_name(pitch)}</text>')
    for note in result["notes"]:
        x_mm = float(note["xMm"])
        if x_mm < start_mm or x_mm > end_mm:
            continue
        cx = x0 + (float(note["row"]) + 0.5) * lane_w
        cy = y0 + (x_mm - start_mm) / segment_len * tape_h
        lines.append(svg_note_circle(cx, cy, note))
    lines.append(f'<text x="{x0 + tape_w / 2:.2f}" y="{y0 + tape_h + text_metrics["segment_y"]:.2f}" text-anchor="middle" font-family="{font_family}" font-size="{text_metrics["segment_size"]:.2f}" fill="#000000">{segment_number}</text>')
    return lines


def pdf_bytes(result: dict[str, Any]) -> bytes:
    pt_per_mm = 72 / 25.4
    page_w_mm, page_h_mm = export_page_size(result)
    page_w, page_h = page_w_mm * pt_per_mm, page_h_mm * pt_per_mm
    layout = export_layout(result, page_w_mm, page_h_mm)
    cols = int(layout["columns"])
    length_mm = max(result["paper"]["lengthMm"], 1)
    segment_len = export_segment_length(result)
    segments = max(1, math.ceil(length_mm / segment_len))
    page_count = math.ceil(segments / cols)
    streams: list[str] = []

    for page in range(page_count):
        stream = ""
        for col in range(cols):
            segment_index = page * cols + col
            if segment_index >= segments:
                continue
            start_mm = segment_index * segment_len
            end_mm = min(length_mm, start_mm + segment_len)
            show_title = segment_index == 0
            strip = strip_box(layout, col, show_title)
            x0 = strip["x"] * pt_per_mm
            y0 = page_h - (strip["y"] + strip["h"]) * pt_per_mm
            stream += draw_pdf_tape_segment(result, x0, y0, strip["w"] * pt_per_mm, strip["h"] * pt_per_mm, start_mm, end_mm, segment_index + 1, show_title, page_h, strip["y"] * pt_per_mm, page_w_mm)
        streams.append(stream)

    return build_pdf_pages(streams, int(page_w), int(page_h), export_font_family(result))


def draw_pdf_tape_segment(
    result: dict[str, Any],
    x0: float,
    y0: float,
    tape_w: float,
    tape_h: float,
    start_mm: float,
    end_mm: float,
    segment_number: int,
    show_title: bool,
    page_h: float,
    tape_top: float,
    page_w_mm: float,
) -> str:
    segment_len = max(end_mm - start_mm, 0.001)
    lane_w = tape_w / 30
    scale_len = tape_h / segment_len
    text_metrics = export_text_metrics(result, page_w_mm, 72 / 25.4)
    unicode_font = export_font_family(result) == "STSong-Light"
    stream = ""
    if show_title:
        title_y = page_h - (tape_top + text_metrics["title_y"])
        stream += centered_text(x0 + tape_w / 2, title_y, text_metrics["title_size"], export_title(result), unicode_font)
    stream += "1 1 1 rg\n"
    stream += f"{x0:.2f} {y0:.2f} {tape_w:.2f} {tape_h:.2f} re f\n"
    stream += "0 0 0 RG 0.65 w\n"
    stream += f"{x0:.2f} {y0:.2f} {tape_w:.2f} {tape_h:.2f} re S\n"
    stream += "0.62 0.62 0.62 RG 0.25 w\n"
    for i in range(31):
        x = x0 + i * lane_w
        stream += f"{x:.2f} {y0:.2f} m {x:.2f} {y0 + tape_h:.2f} l S\n"
    if export_show_measures(result):
        stream += "0 0 0 RG 0.45 w\n"
        first_mark = int(start_mm // 10) * 10
        for mm in range(first_mark, int(end_mm) + 10, 10):
            if mm < start_mm:
                continue
            y = y0 + tape_h - (mm - start_mm) * scale_len
            stream += f"{x0:.2f} {y:.2f} m {x0 + tape_w:.2f} {y:.2f} l S\n"
            if mm % 50 == 0:
                stream += text(x0 + text_metrics["measure_x"], y - text_metrics["measure_y"], text_metrics["measure_size"], str(mm), unicode_font)
    if export_show_pitch(result):
        stream += "0 0 0 rg\n"
        for row in label_rows(result):
            pitch = int(result["paper"]["lowPitch"]) + row
            stream += centered_text(x0 + (row + 0.5) * lane_w, page_h - (tape_top + text_metrics["pitch_y"]), text_metrics["pitch_size"], note_name(pitch), unicode_font)
    stream += "0 0 0 rg\n"
    for note in result["notes"]:
        x_mm = float(note["xMm"])
        if x_mm < start_mm or x_mm > end_mm:
            continue
        cx = x0 + (float(note["row"]) + 0.5) * lane_w
        cy = y0 + tape_h - (x_mm - start_mm) * scale_len
        stream += pdf_note_circle(cx, cy, note)
    stream += "0 0 0 rg\n"
    stream += centered_text(x0 + tape_w / 2, y0 - text_metrics["segment_y"], text_metrics["segment_size"], str(segment_number), unicode_font)
    return stream


def label_rows(result: dict[str, Any]) -> list[int]:
    row_count = int(result["paper"].get("notes", 30))
    anchors = [0, 5, 10, 15, 20, 25, row_count - 1]
    return sorted({row for row in anchors if 0 <= row < row_count})


def export_layout(result: dict[str, Any], page_w: float, page_h: float) -> dict[str, float]:
    px = page_w / 620.0
    pad_x = page_w * 0.048
    pad_top = page_w * 0.048
    pad_bottom = page_w * 0.034
    gap = page_w * 0.024
    columns = max(1, min(export_tape_columns(result), max_tape_columns_for_page(page_w)))
    content_w = page_w - pad_x * 2
    content_h = page_h - pad_top - pad_bottom
    col_w = (content_w - gap * (columns - 1)) / columns
    return {
        "columns": float(columns),
        "pad_x": pad_x,
        "pad_top": pad_top,
        "pad_bottom": pad_bottom,
        "gap": gap,
        "page_gap": 18.0 * px,
        "content_h": content_h,
        "col_w": col_w,
        "strip_margin_top": 14.0 * px,
        "first_strip_margin_top": 32.0 * px,
        "strip_margin_bottom": 18.0 * px,
    }


def export_text_metrics(result: dict[str, Any], page_w_mm: float, scale: float = 1.0) -> dict[str, float]:
    px_unit = page_w_mm / 620.0 * scale
    return {
        "title_size": (export_font_size(result) + 2) * px_unit,
        "title_y": -23.0 * px_unit,
        "pitch_size": 7.0 * px_unit,
        "pitch_y": -7.0 * px_unit,
        "measure_size": 7.0 * px_unit,
        "measure_x": 3.0 * px_unit,
        "measure_y": -2.0 * px_unit,
        "segment_size": 9.0 * px_unit,
        "segment_y": 13.0 * px_unit,
    }


def strip_box(layout: dict[str, float], column: int, first_strip: bool) -> dict[str, float]:
    margin_top = layout["first_strip_margin_top"] if first_strip else layout["strip_margin_top"]
    margin_bottom = layout["strip_margin_bottom"]
    x = layout["pad_x"] + column * (layout["col_w"] + layout["gap"])
    y = layout["pad_top"] + margin_top
    return {
        "x": x,
        "y": y,
        "w": layout["col_w"],
        "h": max(1.0, layout["content_h"] - margin_top - margin_bottom),
    }


def export_segment_length(result: dict[str, Any]) -> float:
    _, page_h = export_page_size(result)
    return max(40.0, page_h - 25.0)


def max_tape_columns_for_page(page_w: float) -> int:
    return max(1, math.floor((page_w - 20 + 5) / (70 + 5)))


def svg_note_circle(cx: float, cy: float, note: dict[str, Any]) -> str:
    if not bool(note.get("mapped", True)):
        return f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="1.85" fill="#ffffff" stroke="#000000" stroke-width="0.5"/>'
    if bool(note.get("spacingWarning", False)):
        return (
            f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="2.45" fill="none" stroke="#000000" stroke-width="0.45"/>'
            f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="1.85" fill="#000000"/>'
        )
    return f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="1.85" fill="#000000"/>'


def pdf_note_circle(cx: float, cy: float, note: dict[str, Any]) -> str:
    if not bool(note.get("mapped", True)):
        return "1 1 1 rg 0 0 0 RG 0.45 w\n" + circle(cx, cy, 1.85, fill=True) + circle(cx, cy, 1.85, fill=False)
    if bool(note.get("spacingWarning", False)):
        return "0 0 0 rg 0 0 0 RG 0.45 w\n" + circle(cx, cy, 1.85, fill=True) + circle(cx, cy, 2.45, fill=False)
    return "0 0 0 rg\n" + circle(cx, cy, 1.85, fill=True)


def escape(text_value: str) -> str:
    return text_value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def paper_range(result: dict[str, Any]) -> str:
    return f"{result['paper']['low']}-{result['paper']['high']}"


def export_title(result: dict[str, Any]) -> str:
    configured = str(result.get("exportOptions", {}).get("title") or "").strip()
    if configured:
        return configured
    filename = str(result.get("filename") or "MIDI2Box")
    if "." in filename:
        filename = filename.rsplit(".", 1)[0]
    return filename.replace("_", " ").replace("-", " ").strip() or "MIDI2Box"


def export_font_family(result: dict[str, Any]) -> str:
    font = str(result.get("exportOptions", {}).get("exportFontFamily") or "Helvetica")
    return font if font in {"Helvetica", "Times", "Courier", "STSong-Light"} else "Helvetica"


def export_font_size(result: dict[str, Any]) -> int:
    try:
        size = int(result.get("exportOptions", {}).get("exportFontSize", 8))
    except (TypeError, ValueError):
        size = 8
    return min(16, max(5, size))


def export_show_pitch(result: dict[str, Any]) -> bool:
    return bool(result.get("exportOptions", {}).get("exportShowPitch", True))


def export_show_measures(result: dict[str, Any]) -> bool:
    return bool(result.get("exportOptions", {}).get("exportShowMeasures", True))


def export_page_size(result: dict[str, Any]) -> tuple[float, float]:
    sizes = {
        "A3": (297.0, 420.0),
        "A4": (210.0, 297.0),
        "A5": (148.0, 210.0),
        "Letter": (216.0, 279.0),
        "Legal": (216.0, 356.0),
    }
    size_name = str(result.get("exportOptions", {}).get("exportPaperSize") or "A4")
    width, height = sizes.get(size_name, sizes["A4"])
    return width, height


def export_tape_columns(result: dict[str, Any]) -> int:
    try:
        columns = int(result.get("exportOptions", {}).get("exportTapeColumns", 2))
    except (TypeError, ValueError):
        columns = 2
    return min(8, max(1, columns))


def safe_pdf_text(value: str) -> str:
    return "".join(ch if ord(ch) >= 32 else " " for ch in value)


def text(x: float, y: float, size: float, value: str, unicode_font: bool = True) -> str:
    return f"BT /F1 {size:.2f} Tf {x:.2f} {y:.2f} Td <{pdf_hex_text(safe_pdf_text(value), unicode_font)}> Tj ET\n"


def centered_text(x: float, y: float, size: float, value: str, unicode_font: bool = True) -> str:
    estimated_width = len(safe_pdf_text(value)) * size * 0.42
    return text(x - estimated_width / 2, y, size, value, unicode_font)


def pdf_hex_text(value: str, unicode_font: bool = True) -> str:
    encoding = "utf-16-be" if unicode_font else "latin-1"
    return value.encode(encoding, "replace").hex().upper()


def circle(cx: float, cy: float, r: float, fill: bool = True) -> str:
    k = 0.5522847498
    c = r * k
    op = "f" if fill else "S"
    return (
        f"{cx + r:.2f} {cy:.2f} m "
        f"{cx + r:.2f} {cy + c:.2f} {cx + c:.2f} {cy + r:.2f} {cx:.2f} {cy + r:.2f} c "
        f"{cx - c:.2f} {cy + r:.2f} {cx - r:.2f} {cy + c:.2f} {cx - r:.2f} {cy:.2f} c "
        f"{cx - r:.2f} {cy - c:.2f} {cx - c:.2f} {cy - r:.2f} {cx:.2f} {cy - r:.2f} c "
        f"{cx + c:.2f} {cy - r:.2f} {cx + r:.2f} {cy - c:.2f} {cx + r:.2f} {cy:.2f} c {op}\n"
    )


def build_pdf(objects: list[bytes]) -> bytes:
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{index} 0 obj\n".encode())
        out.extend(obj)
        out.extend(b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode())
    out.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(out)


def build_pdf_pages(streams: list[str], page_w: int, page_h: int, font_family: str) -> bytes:
    page_count = len(streams)
    font_obj = 3
    page_refs = [4 + index * 2 for index in range(page_count)]
    font_object = pdf_font_object(font_family)
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{' '.join(f'{ref} 0 R' for ref in page_refs)}] /Count {page_count} >>".encode(),
        font_object,
    ]
    for index, stream in enumerate(streams):
        page_obj = page_refs[index]
        content_obj = page_obj + 1
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w} {page_h}] /Resources << /Font << /F1 {font_obj} 0 R >> >> /Contents {content_obj} 0 R >>".encode()
        )
        encoded = stream.encode("latin-1", "replace")
        objects.append(f"<< /Length {len(encoded)} >>\nstream\n".encode() + encoded + b"endstream")
    return build_pdf(objects)


def pdf_font_object(font_family: str) -> bytes:
    base_fonts = {
        "Helvetica": "Helvetica",
        "Times": "Times-Roman",
        "Courier": "Courier",
    }
    if font_family in base_fonts:
        return f"<< /Type /Font /Subtype /Type1 /BaseFont /{base_fonts[font_family]} /Encoding /WinAnsiEncoding >>".encode()
    return b"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [ << /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /DW 1000 >> ] >>"
