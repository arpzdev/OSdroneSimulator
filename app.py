"""
app.py — Drone OS Simulator server
All OS algorithm logic runs here in Python; the browser only renders
what the server decides.

Run:  python app.py   →  http://localhost:5000
"""

from flask import Flask, render_template, request, jsonify

import cpu_scheduling
import memory_management
import disk_scheduling
import file_allocation

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/cpu", methods=["POST"])
def api_cpu():
    d = request.get_json(force=True)
    return jsonify(cpu_scheduling.schedule(
        d.get("processes", []),
        d.get("algorithm", "FCFS"),
        d.get("quantum", 2),
    ))


@app.route("/api/memory", methods=["POST"])
def api_memory():
    d = request.get_json(force=True)
    return jsonify(memory_management.allocate(
        d.get("bays", []),
        int(d.get("size", 1)),
        d.get("strategy", "first"),
    ))


@app.route("/api/disk", methods=["POST"])
def api_disk():
    d = request.get_json(force=True)
    return jsonify(disk_scheduling.run(
        d.get("queue", []),
        int(d.get("head", 0)),
        int(d.get("max", 199)),
        d.get("algorithm", "FCFS"),
        d.get("direction", "right"),
    ))


@app.route("/api/file", methods=["POST"])
def api_file():
    d = request.get_json(force=True)
    return jsonify(file_allocation.allocate(
        d.get("occupied", []),
        int(d.get("size", 1)),
        d.get("method", "contiguous"),
        int(d.get("file_count", 0)),
    ))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
