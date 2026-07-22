"""
file_allocation.py
Contiguous, linked and indexed allocation on a 64-block disk.
The frontend sends the currently occupied block numbers; we return which
blocks the new file should get.
"""

TOTAL_BLOCKS = 64


def _scatter(free, count, offset):
    """Deterministic scatter so linked/indexed files look spread out."""
    pool = list(free)
    picked = []
    step = max(1, len(free) // count)
    idx = (offset * 3) % len(pool)
    while len(picked) < count:
        idx %= len(pool)
        picked.append(pool.pop(idx))
        idx += step
    return picked


def allocate(occupied, size, method, file_count=0, total=TOTAL_BLOCKS):
    occupied = set(occupied)
    free = [i for i in range(total) if i not in occupied]

    if method == "contiguous":
        run = 0
        for i in range(total):
            run = run + 1 if i not in occupied else 0
            if run == size:
                start = i - size + 1
                return {"blocks": list(range(start, start + size)), "index_block": None}
        return {"error": "external_fragmentation",
                "message": f"No contiguous run of {size} free blocks — "
                           "external fragmentation. Try linked or indexed."}

    need = size + 1 if method == "indexed" else size
    if len(free) < need:
        return {"error": "disk_full", "message": "Not enough free blocks."}

    picked = _scatter(free, need, file_count)
    if method == "linked":
        return {"blocks": picked, "index_block": None}
    return {"blocks": picked[1:], "index_block": picked[0]}
