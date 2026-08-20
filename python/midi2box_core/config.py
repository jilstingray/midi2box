from __future__ import annotations

from dataclasses import dataclass

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass(frozen=True)
class MusicBoxSpec:
    name: str
    low_pitch: int
    notes: tuple[int, ...]
    width_mm: float
    seconds_to_mm: float
    hole_radius_mm: float

    @property
    def high_pitch(self) -> int:
        return self.notes[-1]


STANDARD_30_NOTE = MusicBoxSpec(
    name="30-note-standard",
    low_pitch=60,
    notes=tuple(range(60, 90)),
    width_mm=70.0,
    seconds_to_mm=24.0,
    hole_radius_mm=1.25,
)
