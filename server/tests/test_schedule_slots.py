from datetime import time

from app.services.schedule import generate_slot_starts


def test_generate_slot_starts_hourly():
    slots = generate_slot_starts(time(9, 0), time(12, 0), 60)
    assert slots == [
        (time(9, 0), time(10, 0)),
        (time(10, 0), time(11, 0)),
        (time(11, 0), time(12, 0)),
    ]


def test_generate_slot_starts_30_minutes():
    slots = generate_slot_starts(time(9, 0), time(10, 30), 30)
    assert len(slots) == 3
    assert slots[0] == (time(9, 0), time(9, 30))
    assert slots[-1] == (time(10, 0), time(10, 30))


def test_generate_slot_starts_rejects_invalid_window():
    assert generate_slot_starts(time(12, 0), time(9, 0), 30) == []
    assert generate_slot_starts(time(9, 0), time(10, 0), 0) == []


def test_generate_slot_starts_does_not_overflow_end():
    # 45-minute slots in a 90-minute window → exactly 2
    slots = generate_slot_starts(time(9, 0), time(10, 30), 45)
    assert slots == [
        (time(9, 0), time(9, 45)),
        (time(9, 45), time(10, 30)),
    ]
