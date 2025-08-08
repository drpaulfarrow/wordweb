import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

const CATEGORY_META = [
  { key: 'definition', label: 'Definition', color: '#7c6cff' },
  { key: 'synonyms', label: 'Synonyms', color: '#4dd0e1' },
  { key: 'antonyms', label: 'Antonyms', color: '#ef5350' },
  { key: 'idioms', label: 'Idioms', color: '#ffb74d' },
  { key: 'translations', label: 'Translations', color: '#81c784' },
  { key: 'conjugations', label: 'Conjugations', color: '#ffd54f' },
  { key: 'popculture', label: 'Popular Culture', color: '#ba68c8' },
  { key: 'rhymes', label: 'Rhymes', color: '#90caf9' },
];

const INITIAL_WORD = 'light';

export default function MindMap({ onAnnounce }) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [query, setQuery] = useState(INITIAL_WORD);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const polarPoints = useMemo(() => {
    // Precompute positions for eight categories around a circle
    const radius = 200;
    return CATEGORY_META.map((cat, i) => {
      const angle = (i / CATEGORY_META.length) * 2 * Math.PI - Math.PI / 2;
      return {
        ...cat,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }, []);

  async function fetchWord(word) {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/word/${encodeURIComponent(word)}`);
      setData(res.data);
      if (onAnnounce) onAnnounce(`Loaded results for ${word}`);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWord(INITIAL_WORD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data) return;

    const width = svgRef.current.clientWidth || 1000;
    const height = svgRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
      .attr('class', 'mindmap');

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom/pan
    const zoomed = (event) => {
      g.attr('transform', event.transform);
    };
    svg.call(d3.zoom().scaleExtent([0.4, 2.4]).on('zoom', zoomed));

    // Center brain node
    const center = g.append('g').attr('transform', `translate(0,0)`);

    center.append('circle')
      .attr('r', 44)
      .attr('fill', '#16172b')
      .attr('stroke', '#7c6cff')
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)');

    // Brain icon
    center.append('path')
      .attr('d', 'M-16 -20c-8 0-14 6-14 14v1c-4 3-8 7-8 12 0 5 3 9 8 12 0 6 5 10 11 10h7c6 0 11-5 11-11v-1h1c7 0 12-6 12-12v-3c0-16-13-30-28-30z')
      .attr('fill', '#7c6cff')
      .attr('opacity', 0.9);

    center.append('text')
      .attr('y', 60)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .attr('fill', '#b9b9d3')
      .text(data.word);

    // Glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', 3.5).attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    function showTooltip(text, x, y) {
      tooltip.style('display', 'block')
        .style('left', `${x + 14}px`)
        .style('top', `${y + 14}px`)
        .text(text);
    }

    function hideTooltip() {
      tooltip.style('display', 'none');
    }

    // Links and category hubs
    const categoriesGroup = g.append('g');

    // Draw radial links
    categoriesGroup.selectAll('path.link')
      .data(polarPoints)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => d.color)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('d', d => `M0,0 Q ${d.x * 0.2},${d.y * 0.2} ${d.x},${d.y}`)
      .attr('stroke-dasharray', function () {
        const len = this.getTotalLength();
        return `${len} ${len}`;
      })
      .attr('stroke-dashoffset', function () { return this.getTotalLength(); })
      .transition()
      .duration(900)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Category hubs
    const hubs = categoriesGroup.selectAll('g.hub')
      .data(polarPoints)
      .enter()
      .append('g')
      .attr('class', 'hub')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    hubs.append('circle')
      .attr('r', 20)
      .attr('fill', d => d.color)
      .attr('opacity', 0.9)
      .on('mouseenter', function (event, d) {
        const preview = buildPreview(d.key, data);
        showTooltip(preview, event.pageX, event.pageY);
      })
      .on('mouseleave', hideTooltip)
      .on('click', function (event, d) {
        expandCategory(categoriesGroup, d, data, tooltip, showTooltip, hideTooltip);
      });

    hubs.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 36)
      .attr('fill', '#eaeaff')
      .attr('font-size', 12)
      .text(d => d.label);

  }, [data, polarPoints]);

  function buildPreview(categoryKey, payload) {
    const items = payload?.[categoryKey];
    if (!items || items.length === 0) return 'No data';
    if (categoryKey === 'definition') return items[0]?.text || '—';
    if (categoryKey === 'translations') return items.slice(0, 4).map(t => `${t.lang}: ${t.text}`).join(', ');
    if (categoryKey === 'conjugations') return items.slice(0, 4).map(t => t).join(', ');
    return items.slice(0, 6).join(', ');
  }

  function expandCategory(group, hubMeta, payload, tooltip, showTooltip, hideTooltip) {
    const categoryKey = hubMeta.key;
    const rawItems = payload?.[categoryKey] || [];
    const angle = Math.atan2(hubMeta.y, hubMeta.x);

    // Remove any existing expansion of this category before drawing a new one
    group.selectAll(`g[data-branch="${categoryKey}"]`).remove();

    // Prepare nodes with nicer arc spread and truncated labels
    const items = rawItems.slice(0, 16);
    const baseRadius = 92;
    const maxRadius = 220;
    const arcSpread = Math.min(Math.PI / 1.8, 0.15 * items.length + Math.PI / 6);

    const nodes = items.map((item, idx) => {
      const labelRaw = typeof item === 'string' ? item : (item.text || JSON.stringify(item));
      const label = labelRaw.length > 28 ? `${labelRaw.slice(0, 28)}…` : labelRaw;
      const normalized = items.length <= 1 ? 0 : (idx / (items.length - 1)) - 0.5; // -0.5..0.5
      const theta = angle + normalized * arcSpread;
      const ring = baseRadius + (idx % 3) * 34 + Math.floor(idx / 6) * 18;
      return {
        idx,
        label,
        x: hubMeta.x + Math.cos(theta) * ring,
        y: hubMeta.y + Math.sin(theta) * ring,
      };
    });

    // De-overlap using a lightweight force simulation
    const sim = d3.forceSimulation(nodes)
      .force('collide', d3.forceCollide(d => 16 + Math.min(70, d.label.length * 3.2)).iterations(2))
      .force('radial', d3.forceRadial((d, i) => baseRadius + 40 + (i % 5) * 16, hubMeta.x, hubMeta.y).strength(0.25))
      .alpha(0.9)
      .stop();
    for (let i = 0; i < 120; i += 1) sim.tick();

    // Clamp too-distant nodes back towards the hub
    nodes.forEach((n) => {
      const dx = n.x - hubMeta.x;
      const dy = n.y - hubMeta.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        const scale = maxRadius / dist;
        n.x = hubMeta.x + dx * scale;
        n.y = hubMeta.y + dy * scale;
      }
    });

    const branch = group.append('g').attr('data-branch', categoryKey);

    // Curved links with draw-in animation
    branch.selectAll('path.link-leaf')
      .data(nodes, d => d.idx)
      .enter()
      .append('path')
      .attr('class', 'link-leaf')
      .attr('fill', 'none')
      .attr('stroke', hubMeta.color)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 2)
      .attr('d', d => {
        const cx = (hubMeta.x + d.x) / 2 + (d.y - hubMeta.y) * 0.12;
        const cy = (hubMeta.y + d.y) / 2 - (d.x - hubMeta.x) * 0.12;
        return `M${hubMeta.x},${hubMeta.y} Q ${cx},${cy} ${d.x},${d.y}`;
      })
      .attr('stroke-dasharray', function () { const len = this.getTotalLength(); return `${len} ${len}`; })
      .attr('stroke-dashoffset', function () { return this.getTotalLength(); })
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Leaf groups with interactive hover scale
    const leaf = branch.selectAll('g.leaf')
      .data(nodes, d => d.idx)
      .enter()
      .append('g')
      .attr('class', 'leaf')
      .attr('transform', `translate(${hubMeta.x},${hubMeta.y})`)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .raise()
          .transition()
          .duration(180)
          .attr('transform', `translate(${d.x},${d.y}) scale(1.12)`);
        showTooltip(d.label, event.pageX, event.pageY);
      })
      .on('mousemove', function (event, d) {
        showTooltip(d.label, event.pageX, event.pageY);
      })
      .on('mouseleave', function () {
        const datum = d3.select(this).datum();
        d3.select(this)
          .transition()
          .duration(160)
          .attr('transform', `translate(${datum.x},${datum.y}) scale(1)`);
        hideTooltip();
      });

    leaf.append('circle')
      .attr('r', 0)
      .attr('fill', hubMeta.color)
      .attr('opacity', 0.9)
      .transition()
      .duration(650)
      .ease(d3.easeBackOut.overshoot(1.6))
      .attr('r', 13)
      .on('end', function () {
        // Subtle one-shot pulse
        const g = d3.select(this.parentNode);
        g.append('circle')
          .attr('class', 'pulse')
          .attr('r', 13)
          .attr('fill', 'none')
          .attr('stroke', hubMeta.color)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', 2)
          .transition()
          .duration(1200)
          .ease(d3.easeCubicOut)
          .attr('r', 28)
          .attr('stroke-opacity', 0)
          .remove();
      });

    // Label group with background rect for readability
    const labels = leaf.append('g').attr('class', 'label');

    labels.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -18)
      .attr('fill', '#eef1ff')
      .attr('font-size', 12)
      .attr('opacity', 0)
      .text(d => d.label);

    // Compute text bboxes and insert rounded background rects
    labels.each(function () {
      const gSel = d3.select(this);
      const tSel = gSel.select('text');
      const bbox = tSel.node().getBBox();
      gSel.insert('rect', 'text')
        .attr('class', 'label-bg')
        .attr('x', bbox.x - 6)
        .attr('y', bbox.y - 2)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('width', bbox.width + 12)
        .attr('height', bbox.height + 4)
        .attr('fill', 'rgba(22,23,43,0.9)')
        .attr('stroke', 'rgba(255,255,255,0.12)')
        .attr('stroke-width', 1);
    });

    // Final entrance motion for leaves and fade-in of labels
    leaf.transition()
      .delay(120)
      .duration(700)
      .ease(d3.easeBackOut.overshoot(1.4))
      .attr('transform', d => `translate(${d.x},${d.y})`);

    labels.select('text')
      .transition()
      .delay(300)
      .duration(420)
      .attr('opacity', 0.95);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    fetchWord(query.trim());
  }

  return (
    <>
      <form className="header searchbar" onSubmit={onSubmit} style={{ marginTop: 0 }}>
        <input
          aria-label="Enter a word"
          placeholder="Enter a word (e.g., light)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Explore'}
        </button>
      </form>
      {error && (
        <div role="alert" style={{ textAlign: 'center', color: '#ff8a80', marginTop: 8 }}>{error}</div>
      )}
      <div className="canvas-wrap">
        <svg ref={svgRef} className="mindmap" role="img" aria-label="WordWeb Mind Map" />
        <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
      </div>
    </>
  );
}
