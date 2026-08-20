from __future__ import annotations

from .config import NOTE_NAMES


def note_name(pitch: int) -> str:
    return f"{NOTE_NAMES[pitch % 12]}{pitch // 12 - 1}"


def nearest_pitch(pitch: int, candidates: tuple[int, ...]) -> int:
    return min(candidates, key=lambda candidate: abs(candidate - pitch))
