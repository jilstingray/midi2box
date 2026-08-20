from __future__ import annotations

import math
from typing import Any

from .config import MusicBoxSpec, STANDARD_30_NOTE
from .midi import parse_midi, tick_to_seconds
from .models import ConversionOptions, ParsedMidi
from .music import nearest_pitch, note_name


def convert_midi_bytes(raw: bytes, options: dict[str, Any] | None, filename: str) -> dict[str, Any]:
    return convert(parse_midi(raw), ConversionOptions.from_dict(options), filename, STANDARD_30_NOTE)


def convert(parsed: ParsedMidi, options: ConversionOptions, filename: str, spec: MusicBoxSpec) -> dict[str, Any]:
    grid_tick = max(1, parsed.ppq * 4 // options.quantize)
    unmapped: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []

    for note in parsed.notes:
        mapped = map_pitch(note.pitch, options, spec)
        start_tick = round(note.start_tick / grid_tick) * grid_tick
        start_seconds = tick_to_seconds(start_tick, parsed.ppq, parsed.tempos) / options.tempo_scale

        if mapped is None:
            unmapped.append({"pitch": note.pitch, "name": note_name(note.pitch), "tick": note.start_tick})
            continue

        candidates.append(
            {
                "sourcePitch": note.pitch,
                "sourceName": note_name(note.pitch),
                "pitch": mapped,
                "name": note_name(mapped),
                "row": mapped - spec.low_pitch,
                "tick": start_tick,
                "time": start_seconds,
                "velocity": note.velocity,
                "mapped": mapped == note.pitch,
            }
        )

    mm_per_second = layout_mm_per_second(candidates, options, spec)
    notes_out: list[dict[str, Any]] = []
    spacing_warnings: list[dict[str, Any]] = []
    last_by_row: dict[int, float] = {}

    for candidate in sorted(candidates, key=lambda item: (item["time"], item["row"])):
        row = candidate["row"]
        x_mm = candidate["time"] * mm_per_second
        spacing_warning = row in last_by_row and x_mm - last_by_row[row] < options.min_spacing_mm - 0.001
        if spacing_warning:
            spacing_warnings.append({"pitch": candidate["pitch"], "name": candidate["name"], "xMm": round(x_mm, 2)})
        last_by_row[row] = x_mm
        notes_out.append(
            {
                "sourcePitch": candidate["sourcePitch"],
                "sourceName": candidate["sourceName"],
                "pitch": candidate["pitch"],
                "name": candidate["name"],
                "row": row,
                "tick": candidate["tick"],
                "time": round(candidate["time"], 4),
                "xMm": round(x_mm, 3),
                "velocity": candidate["velocity"],
                "mapped": candidate["mapped"],
                "spacingWarning": spacing_warning,
            }
        )

    length_seconds = tick_to_seconds(parsed.max_tick, parsed.ppq, parsed.tempos) / options.tempo_scale
    length_mm = max(80.0, length_seconds * mm_per_second + 24.0)
    measures = math.ceil(parsed.max_tick / max(parsed.ppq * 4, 1))

    return {
        "filename": filename,
        "format": f"SMF Type {parsed.format}",
        "trackCount": parsed.track_count,
        "ppq": parsed.ppq,
        "durationSeconds": round(length_seconds, 2),
        "measureCount": measures,
        "paper": {
            "low": note_name(spec.low_pitch),
            "high": note_name(spec.high_pitch),
            "lowPitch": spec.low_pitch,
            "highPitch": spec.high_pitch,
            "notes": len(spec.notes),
            "widthMm": spec.width_mm,
            "lengthMm": round(length_mm, 1),
            "holeRadiusMm": spec.hole_radius_mm,
            "mmPerSecond": round(mm_per_second, 4),
        },
        "options": {
            "quantize": options.quantize,
            "autoMap": options.auto_map,
            "minSpacingMm": options.min_spacing_mm,
            "tempoScale": options.tempo_scale,
        },
        "notes": sorted(notes_out, key=lambda item: (item["xMm"], item["row"])),
        "unmapped": unmapped[:200],
        "spacingWarnings": spacing_warnings[:200],
    }


def map_pitch(pitch: int, options: ConversionOptions, spec: MusicBoxSpec) -> int | None:
    if pitch in spec.notes:
        return pitch
    if not options.auto_map:
        return None
    return transpose_pitch_into_range(pitch, spec)


def transpose_pitch_into_range(pitch: int, spec: MusicBoxSpec) -> int:
    mapped = pitch
    while mapped < spec.low_pitch:
        mapped += 12
    while mapped > spec.high_pitch:
        mapped -= 12

    if mapped in spec.notes:
        return mapped

    same_pitch_class = [note for note in spec.notes if note % 12 == pitch % 12]
    if same_pitch_class:
        return nearest_pitch(mapped, tuple(same_pitch_class))

    return nearest_pitch(mapped, spec.notes)


def layout_mm_per_second(candidates: list[dict[str, Any]], options: ConversionOptions, spec: MusicBoxSpec) -> float:
    mm_per_second = spec.seconds_to_mm
    last_time_by_row: dict[int, float] = {}

    for candidate in sorted(candidates, key=lambda item: (item["time"], item["row"])):
        row = candidate["row"]
        current_time = candidate["time"]
        if row in last_time_by_row:
            delta_seconds = current_time - last_time_by_row[row]
            if delta_seconds > 0:
                mm_per_second = max(mm_per_second, options.min_spacing_mm / delta_seconds)
        last_time_by_row[row] = current_time

    return mm_per_second
