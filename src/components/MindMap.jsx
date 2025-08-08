import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

const MindMap = () => {
  const svgRef = useRef();
  const [data, setData] = useState({
    name: 'Word',
    children: [],
  });
  const [word, setWord] = useState('');

  const fetchData = async (word) => {
    try {
      const response = await axios.get(`https://api.datamuse.com/words?ml=${word}`);
      const children = response.data.slice(0, 8).map((item) => ({ name: item.word }));
      setData({ name: word, children });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background', '#f4f4f4')
      .style('border', '1px solid #ccc');

    const root = d3.hierarchy(data);
    const treeLayout = d3.tree().size([width - 100, height - 100]);
    treeLayout(root);

    svg.selectAll('*').remove(); // Clear previous render

    const g = svg.append('g').attr('transform', 'translate(50, 50)');

    g.selectAll('line')
      .data(root.links())
      .join('line')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('stroke', '#555');

    g.selectAll('circle')
      .data(root.descendants())
      .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 20)
      .attr('fill', '#69b3a2');

    g.selectAll('text')
      .data(root.descendants())
      .join('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y - 25)
      .attr('text-anchor', 'middle')
      .text(d => d.data.name);
  }, [data]);

  const handleSearch = () => {
    if (word) fetchData(word);
  };

  return (
    <div>
      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Enter a word"
      />
      <button onClick={handleSearch}>Search</button>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default MindMap;
