from __future__ import annotations

import io
import struct

from .models import MidiNote, ParsedMidi


def read_varlen(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    while True:
        if offset >= len(data):
            raise ValueError("Unexpected end of MIDI data while reading varlen")
        byte = data[offset]
        offset += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, offset


def read_chunk(stream: io.BytesIO) -> tuple[bytes, bytes]:
    chunk_id = stream.read(4)
    if len(chunk_id) == 0:
        return b"", b""
    if len(chunk_id) != 4:
        raise ValueError("Invalid MIDI chunk header")
    length_raw = stream.read(4)
    if len(length_raw) != 4:
        raise ValueError("Invalid MIDI chunk length")
    length = struct.unpack(">I", length_raw)[0]
    data = stream.read(length)
    if len(data) != length:
        raise ValueError("Truncated MIDI chunk")
    return chunk_id, data


def parse_midi(raw: bytes) -> ParsedMidi:
    stream = io.BytesIO(raw)
    chunk_id, header = read_chunk(stream)
    if chunk_id != b"MThd" or len(header) < 6:
        raise ValueError("Not a Standard MIDI File")

    midi_format, track_count, division = struct.unpack(">HHH", header[:6])
    if division & 0x8000:
        raise ValueError("SMPTE time division is not supported")

    notes: list[MidiNote] = []
    tempos = [(0, 500000)]
    track_index = 0

    while True:
        chunk_id, track_data = read_chunk(stream)
        if not chunk_id:
            break
        if chunk_id != b"MTrk":
            continue
        parse_track(track_data, track_index, notes, tempos)
        track_index += 1

    max_tick = max([note.end_tick for note in notes] + [0])
    return ParsedMidi(
        format=midi_format,
        track_count=track_count,
        ppq=division,
        notes=notes,
        tempos=sorted(tempos, key=lambda item: item[0]),
        max_tick=max_tick,
    )


def parse_track(track_data: bytes, track: int, notes: list[MidiNote], tempos: list[tuple[int, int]]) -> None:
    offset = 0
    tick = 0
    running_status = None
    active: dict[tuple[int, int], list[tuple[int, int]]] = {}

    while offset < len(track_data):
        delta, offset = read_varlen(track_data, offset)
        tick += delta
        if offset >= len(track_data):
            raise ValueError("Truncated MIDI track event")

        status = track_data[offset]
        if status & 0x80:
            offset += 1
            running_status = status
        elif running_status is not None:
            status = running_status
        else:
            raise ValueError("MIDI running status appears before any status byte")

        if status == 0xFF:
            meta_type = track_data[offset]
            offset += 1
            length, offset = read_varlen(track_data, offset)
            payload = track_data[offset : offset + length]
            offset += length
            if meta_type == 0x51 and length == 3:
                tempos.append((tick, int.from_bytes(payload, "big")))
            if meta_type == 0x2F:
                break
            continue

        if status in (0xF0, 0xF7):
            length, offset = read_varlen(track_data, offset)
            offset += length
            continue

        event_type = status & 0xF0
        channel = status & 0x0F
        data_len = 1 if event_type in (0xC0, 0xD0) else 2
        payload = track_data[offset : offset + data_len]
        offset += data_len
        if len(payload) != data_len:
            raise ValueError("Truncated MIDI event")

        if event_type == 0x90 and payload[1] > 0:
            active.setdefault((channel, payload[0]), []).append((tick, payload[1]))
        elif event_type in (0x80, 0x90):
            key = (channel, payload[0])
            starts = active.get(key)
            if starts:
                start_tick, velocity = starts.pop(0)
                notes.append(MidiNote(payload[0], start_tick, max(tick, start_tick + 1), velocity, track, channel))


def tick_to_seconds(tick: int, ppq: int, tempos: list[tuple[int, int]]) -> float:
    elapsed = 0.0
    prev_tick = 0
    prev_tempo = tempos[0][1] if tempos else 500000
    for tempo_tick, tempo in tempos[1:]:
        if tick <= tempo_tick:
            break
        elapsed += (tempo_tick - prev_tick) * prev_tempo / 1_000_000 / ppq
        prev_tick = tempo_tick
        prev_tempo = tempo
    elapsed += (tick - prev_tick) * prev_tempo / 1_000_000 / ppq
    return elapsed
