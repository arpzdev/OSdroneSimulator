


def _fcfs(queue, head, max_cyl, direction):
    return [{"to": v, "note": ""} for v in queue]


def _sstf(queue, head, max_cyl, direction):
    left, visits, pos = list(queue), [], head
    while left:
        left.sort(key=lambda v: abs(v - pos))
        to = left.pop(0)
        visits.append({"to": to, "note": ""})
        pos = to
    return visits


def _scan(queue, head, max_cyl, direction):
    asc = sorted(queue)
    up = [v for v in asc if v >= head]
    down = [v for v in asc if v < head][::-1]
    visits = []
    if direction == "right":
        visits += [{"to": v, "note": ""} for v in up]
        if down:
            if max_cyl not in up:
                visits.append({"to": max_cyl, "note": "disk edge"})
            visits += [{"to": v, "note": ""} for v in down]
    else:
        visits += [{"to": v, "note": ""} for v in down]
        if up:
            if 0 not in down:
                visits.append({"to": 0, "note": "disk edge"})
            visits += [{"to": v, "note": ""} for v in up]
    return visits


def _cscan(queue, head, max_cyl, direction):
    asc = sorted(queue)
    up = [v for v in asc if v >= head]
    wrap = [v for v in asc if v < head]
    visits = [{"to": v, "note": ""} for v in up]
    if wrap:
        if max_cyl not in up:
            visits.append({"to": max_cyl, "note": "disk edge"})
        visits.append({"to": 0, "note": "wrap around"})
        visits += [{"to": v, "note": ""} for v in wrap]
    return visits


def _look(queue, head, max_cyl, direction):
    asc = sorted(queue)
    up = [v for v in asc if v >= head]
    down = [v for v in asc if v < head][::-1]
    if direction == "right":
        ordered = up + down
    else:
        ordered = down + up
    return [{"to": v, "note": ""} for v in ordered]


def _clook(queue, head, max_cyl, direction):
    asc = sorted(queue)
    up = [v for v in asc if v >= head]
    wrap = [v for v in asc if v < head]
    visits = [{"to": v, "note": ""} for v in up]
    if wrap:
        visits.append({"to": wrap[0], "note": "jump to lowest"})
        visits += [{"to": v, "note": ""} for v in wrap[1:]]
    return visits


_ALGOS = {
    "FCFS": _fcfs, "SSTF": _sstf, "SCAN": _scan,
    "CSCAN": _cscan, "LOOK": _look, "CLOOK": _clook,
}


def run(queue, head, max_cyl, algorithm, direction="right"):
    queue = [v for v in queue if 0 <= v <= max_cyl]
    head = min(max(head, 0), max_cyl)
    visits = _ALGOS.get(algorithm, _fcfs)(queue, head, max_cyl, direction)

    pos, total, steps = head, 0, []
    for v in visits:
        move = abs(v["to"] - pos)
        total += move
        steps.append({"frm": pos, "to": v["to"], "movement": move,
                      "note": v["note"] or "service"})
        pos = v["to"]

    served = len(queue)
    return {
        "steps": steps,
        "total": total,
        "served": served,
        "avg_seek": round(total / served, 1) if served else 0,
        "path": [head] + [v["to"] for v in visits],
    }
