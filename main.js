// Math
document.addEventListener("DOMContentLoaded", () => {
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
});

// Efficiency charts. Numbers mirror the planning-efficiency table.
const BENCHMARKS = ["TwoRoom", "PushT", "Reacher", "OGBench-Cube"];
const DATA = {
  cem:    { name: "LeWM + CEM", color: "var(--series-1)", time: [224.78, 198.92, 326.01, 224.62], success: [82.0, 89.3, 68.0, 73.3], std: [2.0, 6.4, 9.2, 9.0] },
  leflow: { name: "LeFlow",     color: "var(--series-2)", time: [15.58, 17.42, 27.67, 50.23],   success: [100.0, 95.2, 86.8, 100.0], std: [0.0, 3.0, 4.8, 0.0] },
};
const SPEEDUP = ["14.4×", "11.4×", "11.8×", "4.5×"];

const SVG_NS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Column with a 4px rounded data-end and a square baseline.
function columnPath(x, y, w, h, r = 4) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const tooltip = document.querySelector(".chart-tooltip");
const vizRoot = document.querySelector(".viz-root");

function showTooltip(evt, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const root = vizRoot.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  let left = evt.clientX - root.left + 14;
  if (left + tw > root.width) left = evt.clientX - root.left - tw - 14;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${evt.clientY - root.top - 10}px`;
}

function drawChart(container, { metric, max, ticks, format, unit, label }) {
  const W = 520, H = 290, m = { top: 26, right: 8, bottom: 34, left: 40 };
  const pw = W - m.left - m.right, ph = H - m.top - m.bottom;
  const band = pw / BENCHMARKS.length, barW = 24, gap = 2;
  const y = (v) => m.top + ph - (v / max) * ph;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });

  for (const t of ticks) {
    svg.append(el("line", { class: t === 0 ? "base" : "grid", x1: m.left, x2: W - m.right, y1: y(t), y2: y(t) }));
    svg.append(el("text", { class: "tick", x: m.left - 8, y: y(t) + 4, "text-anchor": "end" }, format(t)));
  }

  BENCHMARKS.forEach((name, i) => {
    const cx = m.left + band * i + band / 2;
    const group = el("g");
    const bars = [];
    [DATA.cem, DATA.leflow].forEach((s, j) => {
      const v = s[metric][i];
      const x = j === 0 ? cx - gap / 2 - barW : cx + gap / 2;
      const bar = el("path", { class: "bar", d: columnPath(x, y(v), barW, y(0) - y(v)), fill: s.color });
      bars.push(bar);
      group.append(bar);
      if (metric === "success" && s.std[i] > 0) {
        const wx = x + barW / 2, top = y(Math.min(v + s.std[i], max)), bot = y(v - s.std[i]);
        group.append(el("line", { class: "whisker", x1: wx, x2: wx, y1: top, y2: bot }));
        group.append(el("line", { class: "whisker", x1: wx - 4, x2: wx + 4, y1: top, y2: top }));
        group.append(el("line", { class: "whisker", x1: wx - 4, x2: wx + 4, y1: bot, y2: bot }));
      }
    });

    const labelText = label(i);
    if (labelText) {
      const anchorY = metric === "time"
        ? y(DATA.leflow.time[i]) - 8
        : Math.min(y(DATA.cem.success[i] + DATA.cem.std[i]), y(DATA.leflow.success[i] + DATA.leflow.std[i])) - 8;
      const lx = metric === "time" ? cx + gap / 2 + barW / 2 : cx;
      group.append(el("text", { class: "value-label", x: lx, y: anchorY, "text-anchor": "middle" }, labelText));
    }

    group.append(el("text", { class: "cat", x: cx, y: H - m.bottom + 22, "text-anchor": "middle" }, name));

    const hit = el("rect", { class: "hit", x: cx - band / 2, y: m.top, width: band, height: ph });
    hit.addEventListener("pointermove", (evt) => {
      svg.classList.add("hovering");
      bars.forEach((b) => b.classList.add("active"));
      const row = (s) => {
        const v = s[metric][i];
        const val = metric === "success" ? `${v.toFixed(1)} ± ${s.std[i].toFixed(1)}%` : `${v.toFixed(2)} ${unit}`;
        return `<div class="tt-row"><i class="swatch" style="background:${s.color}"></i>${s.name}<b>${val}</b></div>`;
      };
      const extra = metric === "time" ? `<div class="tt-row">Speedup<b>${SPEEDUP[i]}</b></div>` : "";
      showTooltip(evt, `<div class="tt-head">${name}</div>${row(DATA.cem)}${row(DATA.leflow)}${extra}`);
    });
    hit.addEventListener("pointerleave", () => {
      svg.classList.remove("hovering");
      bars.forEach((b) => b.classList.remove("active"));
      tooltip.hidden = true;
    });
    group.append(hit);
    svg.append(group);
  });

  container.append(svg);
}

drawChart(document.getElementById("chart-time"), {
  metric: "time", max: 350, ticks: [0, 100, 200, 300], unit: "s",
  format: (t) => `${t}`,
  label: (i) => SPEEDUP[i],
});
drawChart(document.getElementById("chart-success"), {
  metric: "success", max: 110, ticks: [0, 25, 50, 75, 100], unit: "%",
  format: (t) => `${t}`,
  label: (i) => `+${(DATA.leflow.success[i] - DATA.cem.success[i]).toFixed(1)}`,
});

// Qualitative tabs
const QUAL = {
  1: { alt: "TwoRoom rollout: the red agent moves from the left room toward the doorway in the wall.",
       caption: "<strong>TwoRoom.</strong> The agent (red dot) must pass through the narrow doorway; LeFlow produces a smooth, door-aware path that avoids the wall." },
  2: { alt: "PushT rollout: the blue agent pushes the grey T block onto the green target pose.",
       caption: "<strong>PushT.</strong> The agent (blue dot) pushes the T-shaped block from a misaligned pose onto the green target, correcting both position and orientation." },
  3: { alt: "Reacher rollout: the two-joint arm swings from pointing up to the goal configuration at the lower right.",
       caption: "<strong>Reacher.</strong> The two-joint arm reconfigures smoothly to the goal joint configuration without oscillation or overshoot." },
  4: { alt: "OGBench-Cube rollout: the robot arm approaches, grasps and repositions the red cube.",
       caption: "<strong>OGBench-Cube.</strong> In 3D, the arm approaches, contacts and repositions the cube to match the goal state." },
};
const qualImg = document.getElementById("qual-image");
const qualCaption = document.getElementById("qual-caption");
const qualTabs = document.querySelectorAll(".tabs button");
function selectRow(row) {
  qualImg.src = `./assets/qual_row${row}.jpg`;
  qualImg.alt = QUAL[row].alt;
  qualCaption.innerHTML = QUAL[row].caption;
  qualTabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.row === String(row))));
}
qualTabs.forEach((b, idx) => {
  b.addEventListener("click", () => selectRow(b.dataset.row));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = qualTabs[(idx + (e.key === "ArrowRight" ? 1 : qualTabs.length - 1)) % qualTabs.length];
    next.focus();
    selectRow(next.dataset.row);
  });
});
selectRow(1);
// Warm the cache so tab switches are instant.
[2, 3, 4].forEach((r) => { new Image().src = `./assets/qual_row${r}.jpg`; });

// Lightbox
const lightbox = document.getElementById("lightbox");
const lightboxImg = lightbox.querySelector("img");
document.querySelectorAll(".figure-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    lightboxImg.src = btn.dataset.zoom;
    lightboxImg.alt = btn.dataset.alt || "";
    lightbox.showModal();
  });
});
lightbox.addEventListener("click", () => lightbox.close());

// BibTeX copy
const copyBtn = document.querySelector(".copy-button");
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById("bibtex-code").textContent);
    copyBtn.textContent = "Copied";
  } catch {
    copyBtn.textContent = "Press ⌘C";
  }
  setTimeout(() => { copyBtn.textContent = "Copy"; }, 1600);
});
