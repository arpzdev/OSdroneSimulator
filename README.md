# Drone OS Simulator

A web based OS concepts simulator where everything is explained through a delivery drone fleet.
The drone is the CPU / disk head, packages are processes, warehouse bays are memory partitions
and the parcel wall is a disk of 64 blocks.

All the algorithm logic runs in **Python** (Flask backend). The browser is only a display —
it sends the current state to the server and animates whatever the Python side decides.

## Requirements

- Python 3.8+
- Flask

```bash
pip install flask
```

## Running

```bash
python app.py
```

then open http://localhost:5000

## Modules

| Module | Algorithms (Python) | Visuals |
|--------|--------------------|---------|
| CPU Scheduling | FCFS, SJF, Priority (non-preemptive), Round Robin | Gantt chart, drone flight animation, metrics table |
| Memory Management | First Fit, Best Fit, Worst Fit | Bay/partition view, internal fragmentation, utilization stats |
| Disk Scheduling | FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK | Seek chart, corridor animation, total head movement |
| File Allocation | Contiguous, Linked, Indexed | 64-block grid, pointer chains, directory table |

## Project Structure

```
droneOSSimulator/
├── app.py                  # Flask server + API routes
├── cpu_scheduling.py       # scheduling algorithms
├── memory_management.py    # fit strategies
├── disk_scheduling.py      # seek algorithms
├── file_allocation.py      # block placement
├── requirements.txt
├── templates/
│   └── index.html          # layout for all four modules
├── static/
│   ├── style.css           # theme
│   └── ui.js               # rendering + drone animation (no algorithm logic here)
└── README.md
```

## API

Every module has one POST endpoint. Send state, get the decision back:

- `POST /api/cpu` — `{processes, algorithm, quantum}` → timeline + metrics
- `POST /api/memory` — `{bays, size, strategy}` → chosen bay + fragmentation
- `POST /api/disk` — `{queue, head, max, algorithm, direction}` → service order + total seek
- `POST /api/file` — `{occupied, size, method}` → allocated blocks / index block

## Notes / metrics cheat sheet

- Turnaround = Completion - Arrival
- Waiting = Turnaround - Burst
- Priority: lower number = higher priority
- SCAN/C-SCAN travel to the disk edge, LOOK/C-LOOK only to the furthest request —
  run both on the same queue and compare total movement
- Contiguous allocation fails when there's no free run big enough even though total
  free space is fine (external fragmentation) — delete a middle file and try it

## Extending

Add the algorithm function in the matching `*.py` file, add a branch in its
dispatcher (`schedule()` / `run()` / `allocate()`), then add an `<option>` in
`templates/index.html`.
