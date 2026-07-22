"""
memory_management.py
First Fit / Best Fit / Worst Fit over fixed partitions (bays).
The frontend sends the current bay state; we return the chosen bay index.
"""


def pick_bay(bays, size, strategy):
    """bays: list of {size, free}. Returns index of chosen bay or -1."""
    free = [(i, b) for i, b in enumerate(bays) if b.get("free", True) and b["size"] >= size]
    if not free:
        return -1
    if strategy == "first":
        return free[0][0]
    if strategy == "best":
        return min(free, key=lambda x: (x[1]["size"], x[0]))[0]
    # worst fit: biggest hole, lowest index on tie
    return max(free, key=lambda x: (x[1]["size"], -x[0]))[0]


def allocate(bays, size, strategy):
    idx = pick_bay(bays, size, strategy)
    if idx == -1:
        return {"bay": -1, "status": "rejected"}
    return {
        "bay": idx,
        "bay_size": bays[idx]["size"],
        "fragmentation": bays[idx]["size"] - size,
        "status": "allocated",
    }
