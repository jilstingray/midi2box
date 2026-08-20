from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class MidiNote:
    pitch: int
    start_tick: int
    end_tick: int
    velocity: int
    track: int
    channel: int


@dataclass(frozen=True)
class ParsedMidi:
    format: int
    track_count: int
    ppq: int
    notes: list[MidiNote]
    tempos: list[tuple[int, int]]
    max_tick: int


@dataclass(frozen=True)
class ConversionOptions:
    quantize: int = 8
    auto_map: bool = True
    min_spacing_mm: float = 1.0
    tempo_scale: float = 1.0

    @classmethod
    def from_dict(cls, value: dict[str, Any] | None) -> "ConversionOptions":
        value = value or {}
        return cls(
            quantize=max(1, int(value.get("quantize", 8))),
            auto_map=bool(value.get("autoMap", value.get("auto_map", True))),
            min_spacing_mm=max(0.0, float(value.get("minSpacingMm", value.get("min_spacing_mm", 1.0)))),
            tempo_scale=max(0.01, float(value.get("tempoScale", value.get("tempo_scale", 1.0)))),
        )
