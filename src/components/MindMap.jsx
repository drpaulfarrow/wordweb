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
    const items = payload?.[categoryKey] || [];
    const angle = Math.atan2(hubMeta.y, hubMeta.x);

    const nodes = items.slice(0, 12).map((item, i) => {
      const r = 70 + (i % 3) * 32;
      const theta = angle + ((Math.floor(i / 3) - 2) * 0.18);
      return {
        label: typeof item === 'string' ? item : (item.text || JSON.stringify(item)),
        x: hubMeta.x + Math.cos(theta) * r,
        y: hubMeta.y + Math.sin(theta) * r,
      };
    });

    const branch = group.append('g').attr('data-branch', categoryKey);

    branch.selectAll('line')
      .data(nodes)
      .enter()
      .append('line')
      .attr('x1', hubMeta.x)
      .attr('y1', hubMeta.y)
      .attr('x2', hubMeta.x)
      .attr('y2', hubMeta.y)
      .attr('stroke', hubMeta.color)
      .attr('stroke-opacity', 0.6)
      .transition()
      .duration(500)
      .attr('x2', d => d.x)
      .attr('y2', d => d.y);

    const leaf = branch.selectAll('g.leaf')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'leaf')
      .attr('transform', d => `translate(${hubMeta.x},${hubMeta.y})`)
      .on('mouseenter', function (event, d) {
        showTooltip(d.label, event.pageX, event.pageY);
      })
      .on('mouseleave', hideTooltip);

    leaf.append('circle')
      .attr('r', 0)
      .attr('fill', hubMeta.color)
      .attr('opacity', 0.9)
      .transition()
      .duration(500)
      .attr('r', 12)
      .attr('transform', d => `translate(${d.x - hubMeta.x},${d.y - hubMeta.y})`);

    leaf.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -16)
      .attr('fill', '#eaeaff')
      .attr('font-size', 11)
      .text(d => d.label)
      .attr('opacity', 0)
      .transition()
      .delay(300)
      .attr('opacity', 0.9)
      .attr('transform', d => `translate(${d.x - hubMeta.x},${d.y - hubMeta.y})`);
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
