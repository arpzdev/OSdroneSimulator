// ui.js — presentation layer only.
// All scheduling / allocation decisions come from the Python backend (app.py).

const COLORS = ["#4cc3ff", "#3ddba6", "#ffb547", "#ff6b81", "#9d7bff", "#5ee1e8", "#f0a5ff", "#b8e986"];
function colorFor(i) { return COLORS[i % COLORS.length]; }
function $(id) { return document.getElementById(id); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function droneSVG(body) {
  const c = body || "#cdd6f4";
  return `
  <svg viewBox="0 0 54 40" xmlns="http://www.w3.org/2000/svg">
    <line x1="10" y1="10" x2="27" y2="20" stroke="${c}" stroke-width="2.4"/>
    <line x1="44" y1="10" x2="27" y2="20" stroke="${c}" stroke-width="2.4"/>
    <line x1="10" y1="30" x2="27" y2="20" stroke="${c}" stroke-width="2.4"/>
    <line x1="44" y1="30" x2="27" y2="20" stroke="${c}" stroke-width="2.4"/>
    <g class="rotor"><ellipse cx="10" cy="10" rx="8" ry="2.6" fill="none" stroke="#9db4ff" stroke-width="1.6"/></g>
    <g class="rotor"><ellipse cx="44" cy="10" rx="8" ry="2.6" fill="none" stroke="#9db4ff" stroke-width="1.6"/></g>
    <g class="rotor"><ellipse cx="10" cy="30" rx="8" ry="2.6" fill="none" stroke="#9db4ff" stroke-width="1.6"/></g>
    <g class="rotor"><ellipse cx="44" cy="30" rx="8" ry="2.6" fill="none" stroke="#9db4ff" stroke-width="1.6"/></g>
    <rect x="20" y="15" width="14" height="10" rx="3.5" fill="${c}"/>
    <circle cx="27" cy="20" r="2.2" fill="#0b1020"/>
  </svg>`;
}

// tab switching
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("panel-" + btn.dataset.tab).classList.add("active");
  });
});
$("logo-drone").innerHTML = droneSVG("#4cc3ff");

/* ==================== CPU SCHEDULING ==================== */
(function () {
  let procs = [];
  let nextPid = 1;
  let runToken = 0;

  const droneEl = $("cpu-drone");
  droneEl.innerHTML = droneSVG();
  droneEl.classList.add("drone-hover");

  function renderProcTable() {
    const tb = $("cpu-ptable").querySelector("tbody");
    tb.innerHTML = "";
    procs.forEach((p, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td><span class="pid-chip" style="background:${colorFor(p.pid - 1)}">P${p.pid}</span></td>` +
        `<td>${p.arrival}</td><td>${p.burst}</td><td>${p.priority}</td>` +
        `<td><button class="del" title="remove">&#10005;</button></td>`;
      tr.querySelector(".del").onclick = () => { procs.splice(idx, 1); renderProcTable(); };
      tb.appendChild(tr);
    });
  }

  function renderGantt(timeline) {
    const g = $("cpu-gantt"), axis = $("cpu-axis");
    g.innerHTML = ""; axis.innerHTML = "";
    const total = timeline.length ? timeline[timeline.length - 1].end : 0;
    timeline.forEach(seg => {
      const div = document.createElement("div");
      const dur = seg.end - seg.start;
      div.className = "gseg" + (seg.pid === null ? " idle" : "");
      div.style.flexGrow = dur;
      div.style.background = seg.pid === null ? "" : colorFor(seg.pid - 1);
      div.innerHTML = seg.pid === null
        ? `idle<small>${seg.start}&ndash;${seg.end}</small>`
        : `P${seg.pid}<small>${seg.start}&ndash;${seg.end}</small>`;
      g.appendChild(div);
      const tick = document.createElement("span");
      tick.style.flexGrow = dur;
      tick.textContent = seg.start;
      axis.appendChild(tick);
    });
    const endTick = document.createElement("span");
    endTick.textContent = total;
    endTick.style.flexGrow = 0;
    axis.appendChild(endTick);
    return [...g.children];
  }

  function renderResults(data) {
    const tb = $("cpu-results").querySelector("tbody");
    tb.innerHTML = "";
    data.results.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td><span class="pid-chip" style="background:${colorFor(r.pid - 1)}">P${r.pid}</span></td>` +
        `<td>${r.arrival}</td><td>${r.burst}</td><td>${r.completion}</td><td>${r.turnaround}</td><td>${r.waiting}</td>`;
      tb.appendChild(tr);
    });
    $("cpu-avg").innerHTML =
      `<span class="stat">Avg Waiting Time<b>${data.avg_waiting}</b></span>` +
      `<span class="stat">Avg Turnaround Time<b>${data.avg_turnaround}</b></span>` +
      `<span class="stat">Total Time<b>${data.total_time}</b></span>`;
  }

  function renderQueueStrip(state) {
    const strip = $("cpu-queue");
    strip.innerHTML = "";
    procs.forEach(p => {
      const chip = document.createElement("span");
      const st = state[p.pid] || "waiting";
      chip.className = "qchip " + (st === "running" ? "running" : st === "done" ? "done" : "");
      if (st === "running") chip.style.background = colorFor(p.pid - 1);
      chip.textContent = `P${p.pid}`;
      strip.appendChild(chip);
    });
  }

  async function animate(data) {
    const token = ++runToken;
    const timeline = data.timeline;
    const segEls = renderGantt(timeline);
    renderResults(data);

    const airspace = $("cpu-airspace");
    const carry = $("cpu-carry");
    const flightPx = airspace.clientWidth - 130;
    const unit = 620 - (+$("cpu-speed").value * 55);

    const state = {}, remaining = {};
    procs.forEach(p => { remaining[p.pid] = p.burst; });
    renderQueueStrip(state);

    for (const seg of timeline) {
      if (token !== runToken) return;
      const dur = (seg.end - seg.start) * Math.max(unit, 60);
      $("cpu-clock").textContent = `t = ${seg.start}`;

      if (seg.pid === null) {
        droneEl.style.transform = "translateX(0)";
        carry.classList.add("hidden");
        await sleep(dur);
      } else {
        state[seg.pid] = "running";
        renderQueueStrip(state);
        carry.textContent = `P${seg.pid}`;
        carry.style.background = colorFor(seg.pid - 1);
        carry.classList.remove("hidden");
        carry.style.left = "34px";
        carry.style.top = "78px";

        droneEl.style.transition = `transform ${dur / 2}ms linear`;
        carry.style.transition = `transform ${dur / 2}ms linear`;
        droneEl.style.transform = `translateX(${flightPx}px)`;
        carry.style.transform = `translateX(${flightPx}px)`;
        await sleep(dur / 2);
        if (token !== runToken) return;

        carry.classList.add("hidden");
        carry.style.transform = "translateX(0)";
        droneEl.style.transform = "translateX(0)";
        await sleep(dur / 2);
        if (token !== runToken) return;

        remaining[seg.pid] -= (seg.end - seg.start);
        state[seg.pid] = remaining[seg.pid] <= 0 ? "done" : "waiting";
        renderQueueStrip(state);
      }
      segEls[timeline.indexOf(seg)].classList.add("lit");
      $("cpu-clock").textContent = `t = ${seg.end}`;
    }
    droneEl.style.transition = "transform .5s ease";
  }

  $("cpu-algo").addEventListener("change", () => {
    $("cpu-quantum-row").classList.toggle("hidden", $("cpu-algo").value !== "RR");
  });

  $("cpu-add").onclick = () => {
    procs.push({
      pid: nextPid++,
      arrival: Math.max(0, +$("cpu-arrival").value || 0),
      burst: Math.max(1, +$("cpu-burst").value || 1),
      priority: Math.max(1, +$("cpu-priority").value || 1),
    });
    renderProcTable();
  };

  $("cpu-sample").onclick = () => {
    procs = [
      { pid: 1, arrival: 0, burst: 6, priority: 3 },
      { pid: 2, arrival: 1, burst: 3, priority: 1 },
      { pid: 3, arrival: 2, burst: 8, priority: 4 },
      { pid: 4, arrival: 3, burst: 2, priority: 2 },
      { pid: 5, arrival: 5, burst: 4, priority: 5 },
    ];
    nextPid = 6;
    renderProcTable();
  };

  $("cpu-clear").onclick = () => {
    procs = []; nextPid = 1; runToken++;
    renderProcTable();
    $("cpu-gantt").innerHTML = '<span class="placeholder">Run a simulation to see the timeline.</span>';
    $("cpu-axis").innerHTML = "";
    $("cpu-results").querySelector("tbody").innerHTML = "";
    $("cpu-avg").innerHTML = "";
    $("cpu-queue").innerHTML = "";
    $("cpu-clock").textContent = "t = 0";
    droneEl.style.transform = "translateX(0)";
  };

  $("cpu-run").onclick = async () => {
    if (!procs.length) { alert("Add at least one delivery order first."); return; }
    const data = await api("/api/cpu", {
      processes: procs,
      algorithm: $("cpu-algo").value,
      quantum: Math.max(1, +$("cpu-quantum").value || 2),
    });
    animate(data);
  };
})();

/* ==================== MEMORY MANAGEMENT ==================== */
(function () {
  let bays = [];
  let history = [];
  let pkgCounter = 1;

  const droneEl = $("mem-drone");
  droneEl.innerHTML = droneSVG("#ffb547");

  function buildBays() {
    const sizes = $("mem-sizes").value.split(",")
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
    bays = sizes.map(size => ({ size, owner: null }));
    history = [];
    pkgCounter = 1;
    render();
  }

  function render() {
    const wrap = $("mem-bays");
    wrap.innerHTML = "";
    const maxSize = Math.max(...bays.map(b => b.size), 1);

    bays.forEach((bay, i) => {
      const el = document.createElement("div");
      el.className = "bay";
      const colH = 60 + Math.round((bay.size / maxSize) * 150);
      const col = document.createElement("div");
      col.className = "bay-col";
      col.style.height = colH + "px";

      if (bay.owner) {
        const usedH = Math.round((bay.owner.size / bay.size) * colH);
        const frag = bay.size - bay.owner.size;
        if (frag > 0) {
          const fragEl = document.createElement("div");
          fragEl.className = "bay-frag";
          fragEl.style.height = (colH - usedH) + "px";
          fragEl.textContent = frag + " KB frag";
          col.appendChild(fragEl);
        }
        const fill = document.createElement("div");
        fill.className = "bay-fill";
        fill.style.height = usedH + "px";
        fill.style.background = colorFor(bay.owner.idx);
        fill.textContent = bay.owner.name;
        col.appendChild(fill);
        el.title = "Click to deallocate " + bay.owner.name;
        el.onclick = () => {
          const row = history.find(h => h.name === bay.owner.name && h.status === "allocated");
          if (row) row.status = "freed";
          bay.owner = null;
          render();
        };
      }

      const label = document.createElement("div");
      label.className = "bay-label";
      label.innerHTML = `<b>Bay ${i}</b><br>${bay.size} KB`;
      el.appendChild(col);
      el.appendChild(label);
      wrap.appendChild(el);
    });
    renderTable();
  }

  function renderTable() {
    const tb = $("mem-table").querySelector("tbody");
    tb.innerHTML = "";
    history.forEach(h => {
      const tr = document.createElement("tr");
      const cls = h.status === "allocated" ? "ok" : h.status === "rejected" ? "fail" : "";
      tr.innerHTML =
        `<td><span class="pid-chip" style="background:${colorFor(h.idx)}">${h.name}</span></td>` +
        `<td>${h.size} KB</td><td>${h.strategy}</td>` +
        `<td>${h.bay === -1 ? "—" : "Bay " + h.bay}</td>` +
        `<td>${h.bay === -1 ? "—" : h.baySize + " KB"}</td>` +
        `<td>${h.bay === -1 ? "—" : h.frag + " KB"}</td>` +
        `<td class="${cls}">${h.status}</td>`;
      tb.appendChild(tr);
    });

    const totalMem = bays.reduce((s, b) => s + b.size, 0);
    const usedMem = bays.reduce((s, b) => s + (b.owner ? b.owner.size : 0), 0);
    const fragMem = bays.reduce((s, b) => s + (b.owner ? b.size - b.owner.size : 0), 0);
    $("mem-stats").innerHTML =
      `<span class="stat">Total Memory<b>${totalMem} KB</b></span>` +
      `<span class="stat">In Use<b>${usedMem} KB</b></span>` +
      `<span class="stat">Utilization<b>${totalMem ? ((usedMem / totalMem) * 100).toFixed(1) : 0}%</b></span>` +
      `<span class="stat">Internal Fragmentation<b>${fragMem} KB</b></span>`;
  }

  async function allocate(size, strategy, silent) {
    const idx = pkgCounter - 1;
    const name = "PKG" + pkgCounter++;

    // Python decides which bay fits
    const resp = await api("/api/memory", {
      bays: bays.map(b => ({ size: b.size, free: !b.owner })),
      size, strategy,
    });

    const row = {
      name, size, strategy, idx,
      bay: resp.bay,
      baySize: resp.bay === -1 ? 0 : resp.bay_size,
      frag: resp.bay === -1 ? 0 : resp.fragmentation,
      status: resp.status,
    };
    history.push(row);

    if (resp.bay === -1) {
      renderTable();
      if (!silent) alert(`${name} (${size} KB): no bay large enough — allocation failed.`);
      return;
    }

    const card = $("mem-bays").parentElement;
    const bayEl = $("mem-bays").children[resp.bay];
    if (bayEl) {
      const cardBox = card.getBoundingClientRect();
      const bayBox = bayEl.getBoundingClientRect();
      droneEl.classList.remove("hidden");
      droneEl.style.left = "10px";
      droneEl.style.top = "6px";
      droneEl.style.transition = "none";
      droneEl.style.transform = "translate(0,0)";
      void droneEl.offsetWidth;
      const dx = bayBox.left - cardBox.left + bayBox.width / 2 - 37;
      const dy = bayBox.top - cardBox.top - 10;
      droneEl.style.transition = "transform .7s ease";
      droneEl.style.transform = `translate(${dx}px, ${dy}px)`;
      await sleep(720);
      droneEl.classList.add("hidden");
    }

    bays[resp.bay].owner = { name, size, idx };
    render();
  }

  $("mem-apply").onclick = buildBays;
  $("mem-reset").onclick = buildBays;
  $("mem-alloc").onclick = () => {
    allocate(Math.max(1, +$("mem-size").value || 1), $("mem-strategy").value, false);
  };
  $("mem-sample").onclick = async () => {
    buildBays();
    const strategy = $("mem-strategy").value;
    for (const s of [212, 417, 112, 426]) {
      await allocate(s, strategy, true);
      await sleep(150);
    }
  };

  buildBays();
})();

/* ==================== DISK SCHEDULING ==================== */
(function () {
  let runToken = 0;

  const droneEl = $("dsk-drone");
  droneEl.innerHTML = droneSVG("#3ddba6");

  function parseInputs() {
    const queue = $("dsk-queue").value.split(",")
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0);
    const head = Math.max(0, +$("dsk-head").value || 0);
    const max = Math.max(10, +$("dsk-max").value || 199);
    return { queue: queue.filter(q => q <= max), head: Math.min(head, max), max };
  }

  function xFor(v, max, trackW) { return 30 + (v / max) * trackW; }

  function buildCorridor(queue, head, max) {
    const corridor = $("dsk-corridor");
    corridor.querySelectorAll(".stop-marker").forEach(m => m.remove());
    const trackW = corridor.clientWidth - 60;

    queue.forEach(v => {
      const m = document.createElement("div");
      m.className = "stop-marker";
      m.dataset.v = v;
      m.style.left = xFor(v, max, trackW) + "px";
      corridor.appendChild(m);
    });
    const hm = document.createElement("div");
    hm.className = "stop-marker head-mark";
    hm.dataset.v = head;
    hm.style.left = xFor(head, max, trackW) + "px";
    corridor.appendChild(hm);

    droneEl.style.transition = "none";
    droneEl.style.transform = `translateX(${xFor(head, max, trackW) - 27}px)`;
    void droneEl.offsetWidth;
    return trackW;
  }

  function drawChart(path, max, upTo) {
    const cv = $("dsk-chart");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const padL = 40, padR = 25, padT = 34, padB = 20;
    ctx.clearRect(0, 0, W, H);

    const xOf = v => padL + (v / max) * (W - padL - padR);
    const yOf = i => padT + (path.length <= 1 ? 0 : (i / (path.length - 1)) * (H - padT - padB));

    ctx.strokeStyle = "#27325c";
    ctx.fillStyle = "#8b96b8";
    ctx.font = "11px Segoe UI";
    ctx.beginPath();
    ctx.moveTo(padL, padT - 12); ctx.lineTo(W - padR, padT - 12);
    ctx.stroke();
    for (let v = 0; v <= max; v += Math.ceil(max / 8)) ctx.fillText(v, xOf(v) - 8, padT - 18);
    ctx.fillText(max, xOf(max) - 14, padT - 18);

    ctx.strokeStyle = "#4cc3ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= upTo && i < path.length; i++) {
      const x = xOf(path[i]), y = yOf(i);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (let i = 0; i <= upTo && i < path.length; i++) {
      const x = xOf(path[i]), y = yOf(i);
      ctx.fillStyle = i === 0 ? "#ffb547" : "#3ddba6";
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e7ecf8";
      ctx.fillText(path[i], x + 7, y + 4);
    }
  }

  async function run() {
    const token = ++runToken;
    const { queue, head, max } = parseInputs();
    if (!queue.length) { alert("Add at least one drop point."); return; }

    // Python computes the whole service order + distances
    const data = await api("/api/disk", {
      queue, head, max,
      algorithm: $("dsk-algo").value,
      direction: $("dsk-dir").value,
    });

    const trackW = buildCorridor(queue, head, max);
    const tb = $("dsk-table").querySelector("tbody");
    tb.innerHTML = "";
    $("dsk-total").innerHTML = "";
    $("dsk-odometer").textContent = "travelled: 0";
    drawChart(data.path, max, 0);

    let travelled = 0;
    for (let i = 0; i < data.steps.length; i++) {
      if (token !== runToken) return;
      const s = data.steps[i];
      travelled += s.movement;

      const dur = Math.max(240, s.movement * 9);
      droneEl.style.transition = `transform ${dur}ms ease-in-out`;
      droneEl.style.transform = `translateX(${xFor(s.to, max, trackW) - 27}px)`;
      await sleep(dur + 60);
      if (token !== runToken) return;

      document.querySelectorAll("#dsk-corridor .stop-marker").forEach(m => {
        if (+m.dataset.v === s.to && !m.classList.contains("head-mark")) m.classList.add("visited");
      });

      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i + 1}</td><td>${s.frm}</td><td>${s.to}</td><td>${s.movement}</td><td>${s.note}</td>`;
      tb.appendChild(tr);
      $("dsk-odometer").textContent = "travelled: " + travelled;
      drawChart(data.path, max, i + 1);
    }

    $("dsk-total").innerHTML =
      `<span class="stat">Total Head Movement<b>${data.total}</b></span>` +
      `<span class="stat">Requests Serviced<b>${data.served}</b></span>` +
      `<span class="stat">Avg Seek / Request<b>${data.avg_seek}</b></span>`;
  }

  function reset() {
    runToken++;
    const { queue, head, max } = parseInputs();
    buildCorridor(queue, head, max);
    drawChart([head], max, 0);
    $("dsk-table").querySelector("tbody").innerHTML = "";
    $("dsk-total").innerHTML = "";
    $("dsk-odometer").textContent = "travelled: 0";
  }

  $("dsk-run").onclick = run;
  $("dsk-reset").onclick = reset;
  $("dsk-sample").onclick = () => {
    $("dsk-queue").value = "98, 183, 37, 122, 14, 124, 65, 67";
    $("dsk-head").value = 53;
    $("dsk-max").value = 199;
    reset();
  };
  $("dsk-algo").addEventListener("change", () => {
    const a = $("dsk-algo").value;
    $("dsk-dir-row").classList.toggle("hidden", a === "FCFS" || a === "SSTF" || a === "CSCAN" || a === "CLOOK");
  });

  window.addEventListener("load", reset);
})();

/* ==================== FILE ALLOCATION ==================== */
(function () {
  const N = 64;
  let blocks = [];
  let files = [];
  let colorCounter = 0;
  let fileCount = 0;

  function freshDisk() {
    blocks = Array.from({ length: N }, () => ({ owner: null, kind: "data", seq: 0 }));
    [0, 1, 20, 33, 47].forEach(i => { blocks[i].owner = "__sys__"; });
    files = [];
    colorCounter = 0;
    fileCount = 0;
    render();
  }

  function occupiedList() {
    return blocks.map((b, i) => (b.owner !== null ? i : -1)).filter(i => i !== -1);
  }

  async function storeFile(name, size, method) {
    if (files.some(f => f.name === name)) {
      alert(`A file named "${name}" already exists. Pick another name.`);
      return false;
    }

    // Python decides block placement
    const resp = await api("/api/file", {
      occupied: occupiedList(), size, method, file_count: fileCount,
    });

    if (resp.error) { alert(resp.message); return false; }

    fileCount++;
    const f = {
      name, method, size,
      blocks: resp.blocks,
      indexBlock: resp.index_block,
      colorIdx: colorCounter++,
    };
    files.push(f);
    resp.blocks.forEach((b, k) => { blocks[b] = { owner: name, kind: "data", seq: k + 1 }; });
    if (resp.index_block !== null) blocks[resp.index_block] = { owner: name, kind: "index", seq: 0 };
    render(f);
    return true;
  }

  function deleteFile(name) {
    const f = files.find(x => x.name === name);
    if (!f) return;
    f.blocks.forEach(b => { blocks[b] = { owner: null, kind: "data", seq: 0 }; });
    if (f.indexBlock !== null) blocks[f.indexBlock] = { owner: null, kind: "data", seq: 0 };
    files = files.filter(x => x !== f);
    render();
  }

  function render(animateFile) {
    const grid = $("fil-grid");
    grid.innerHTML = "";
    blocks.forEach((b, i) => {
      const cell = document.createElement("div");
      cell.className = "blk";
      cell.dataset.i = i;
      cell.innerHTML = `<span class="bno">${i}</span>`;
      if (b.owner === "__sys__") cell.classList.add("reserved");
      else if (b.owner) {
        const f = files.find(x => x.name === b.owner);
        if (f) {
          cell.style.background = colorFor(f.colorIdx);
          cell.style.borderColor = colorFor(f.colorIdx);
          if (b.kind === "index") {
            cell.classList.add("indexblk");
            cell.innerHTML += `<span class="owner">${f.name.slice(0, 6)}</span><span class="seq">index</span>`;
          } else {
            cell.innerHTML += `<span class="owner">${f.name.slice(0, 6)}</span><span class="seq">#${b.seq}</span>`;
          }
        }
      }
      grid.appendChild(cell);
    });

    drawChains();
    renderTable();
    if (animateFile) animateStore(animateFile);
  }

  function cellCenter(i) {
    const grid = $("fil-grid");
    const cell = grid.children[i];
    const g = grid.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    return { x: c.left - g.left + c.width / 2, y: c.top - g.top + c.height / 2 };
  }

  function drawChains() {
    const svg = $("fil-svg");
    const grid = $("fil-grid");
    svg.setAttribute("viewBox", `0 0 ${grid.clientWidth} ${grid.clientHeight}`);
    svg.innerHTML = `
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="#e7ecf8"/>
        </marker>
      </defs>`;

    files.forEach(f => {
      const col = colorFor(f.colorIdx);
      if (f.method === "linked") {
        for (let k = 0; k < f.blocks.length - 1; k++) {
          const a = cellCenter(f.blocks[k]);
          const b = cellCenter(f.blocks[k + 1]);
          svg.innerHTML += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
            stroke="${col}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#arr)" opacity="0.85"/>`;
        }
      } else if (f.method === "indexed" && f.indexBlock !== null) {
        const idx = cellCenter(f.indexBlock);
        f.blocks.forEach(bi => {
          const b = cellCenter(bi);
          svg.innerHTML += `<line x1="${idx.x}" y1="${idx.y}" x2="${b.x}" y2="${b.y}"
            stroke="${col}" stroke-width="1.6" opacity="0.55" marker-end="url(#arr)"/>`;
        });
      }
    });
  }

  async function animateStore(f) {
    const order = f.indexBlock !== null ? [f.indexBlock, ...f.blocks] : f.blocks;
    const grid = $("fil-grid");
    for (const bi of order) {
      const cell = grid.children[bi];
      if (!cell) continue;
      cell.style.transform = "scale(1.18)";
      cell.style.boxShadow = "0 0 14px " + colorFor(f.colorIdx);
      await sleep(110);
      cell.style.transform = "";
      cell.style.boxShadow = "";
    }
  }

  function renderTable() {
    const tb = $("fil-table").querySelector("tbody");
    tb.innerHTML = "";
    files.forEach(f => {
      const tr = document.createElement("tr");
      const start = f.method === "indexed" ? `index @ ${f.indexBlock}` : `block ${f.blocks[0]}`;
      tr.innerHTML =
        `<td><span class="pid-chip" style="background:${colorFor(f.colorIdx)}">${f.name}</span></td>` +
        `<td>${f.method}</td><td>${f.size} blk</td><td>${start}</td>` +
        `<td>${f.blocks.join(" → ")}</td>` +
        `<td><button class="del" title="delete">&#10005;</button></td>`;
      tr.querySelector(".del").onclick = () => deleteFile(f.name);
      tb.appendChild(tr);
    });
  }

  $("fil-add").onclick = () => {
    const name = ($("fil-name").value || "file").trim();
    const size = Math.min(20, Math.max(1, +$("fil-size").value || 1));
    storeFile(name, size, $("fil-method").value);
  };

  $("fil-sample").onclick = async () => {
    freshDisk();
    await storeFile("routes.db", 6, "contiguous");
    await storeFile("orders.log", 5, "linked");
    await storeFile("manifest", 4, "indexed");
  };

  $("fil-reset").onclick = freshDisk;

  window.addEventListener("resize", drawChains);
  window.addEventListener("load", freshDisk);
})();
