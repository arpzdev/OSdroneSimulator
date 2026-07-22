"""
cpu_scheduling.py
FCFS, SJF (non-preemptive), Priority (non-preemptive), Round Robin.
Returns a Gantt timeline plus per-process metrics.
"""


def _non_preemptive(processes, key):
    pending = [dict(p) for p in processes]
    timeline, finished = [], []
    t = 0
    while pending:
        ready = [p for p in pending if p["arrival"] <= t]
        if not ready:
            nt = min(p["arrival"] for p in pending)
            timeline.append({"pid": None, "start": t, "end": nt})
            t = nt
            continue
        ready.sort(key=lambda p: (p[key], p["arrival"], p["pid"]))
        p = ready[0]
        pending.remove(p)
        timeline.append({"pid": p["pid"], "start": t, "end": t + p["burst"]})
        t += p["burst"]
        p["completion"] = t
        finished.append(p)
    return timeline, finished


def _round_robin(processes, quantum):
    ps = sorted((dict(p, rem=p["burst"]) for p in processes),
                key=lambda p: (p["arrival"], p["pid"]))
    timeline, finished, queue = [], [], []
    t, i = 0, 0
    while len(finished) < len(ps):
        while i < len(ps) and ps[i]["arrival"] <= t:
            queue.append(ps[i])
            i += 1
        if not queue:
            nt = ps[i]["arrival"]
            timeline.append({"pid": None, "start": t, "end": nt})
            t = nt
            continue
        p = queue.pop(0)
        run = min(quantum, p["rem"])
        timeline.append({"pid": p["pid"], "start": t, "end": t + run})
        t += run
        p["rem"] -= run
        while i < len(ps) and ps[i]["arrival"] <= t:
            queue.append(ps[i])
            i += 1
        if p["rem"] > 0:
            queue.append(p)
        else:
            p["completion"] = t
            finished.append(p)
    return timeline, finished


def schedule(processes, algorithm, quantum=2):
    if algorithm == "FCFS":
        timeline, fin = _non_preemptive(processes, "arrival")
    elif algorithm == "SJF":
        timeline, fin = _non_preemptive(processes, "burst")
    elif algorithm == "PRIORITY":
        timeline, fin = _non_preemptive(processes, "priority")
    else:  # RR
        timeline, fin = _round_robin(processes, max(1, int(quantum)))

    results = []
    for p in sorted(fin, key=lambda x: x["pid"]):
        tat = p["completion"] - p["arrival"]
        results.append({
            "pid": p["pid"],
            "arrival": p["arrival"],
            "burst": p["burst"],
            "completion": p["completion"],
            "turnaround": tat,
            "waiting": tat - p["burst"],
        })

    n = len(results) or 1
    return {
        "timeline": timeline,
        "results": results,
        "avg_waiting": round(sum(r["waiting"] for r in results) / n, 2),
        "avg_turnaround": round(sum(r["turnaround"] for r in results) / n, 2),
        "total_time": max((r["completion"] for r in results), default=0),
    }
