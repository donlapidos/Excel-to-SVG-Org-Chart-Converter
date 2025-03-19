import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { OrgChart } from 'd3-org-chart';
import * as d3 from 'd3';

const ExcelToSvg = () => {
  const [chartData, setChartData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const chartRef = useRef();
  const containerRef = useRef();

  // Color scheme for different levels
  const levelColors = {
    0: '#ff7043', // Orange for top level
    1: '#29b6f6', // Light blue for second level
    2: '#66bb6a', // Green for third level
    3: '#42a5f5', // Blue for fourth level
    default: '#90caf9' // Default light blue
  };

  // Helper function to find the actual column name regardless of case
  const findColumn = (row, columnName) => {
    const lowerColumnName = columnName.toLowerCase();
    const actualColumn = Object.keys(row).find(
      key => key.toLowerCase() === lowerColumnName
    );
    return actualColumn ? row[actualColumn] : null;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setLoading(true);
    setError(null);
    setChartData(null);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let jsonData;
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType === 'csv') {
          // Handle CSV files
          const csvData = e.target.result;
          jsonData = XLSX.read(csvData, { type: 'binary' });
        } else {
          // Handle Excel files
          const data = new Uint8Array(e.target.result);
          jsonData = XLSX.read(data, { type: 'array' });
        }

        const sheetData = XLSX.utils.sheet_to_json(
          jsonData.Sheets[jsonData.SheetNames[0]]
        );

        if (sheetData.length === 0) {
          throw new Error('The file appears to be empty');
        }

        // Simplified data transformation
        const orgChartData = sheetData.map((row, index) => ({
          id: index.toString(),
          name: findColumn(row, 'name') || '',
          title: findColumn(row, 'title') || '',
          reportsTo: findColumn(row, 'reports to') || ''
        }));

        // Create parentId relationships
        const nameToId = new Map(orgChartData.map(item => [item.name, item.id]));
        
        orgChartData.forEach(item => {
          item.parentId = item.reportsTo ? nameToId.get(item.reportsTo) : null;
          delete item.reportsTo;  // Clean up the temporary field
        });

        setChartData(orgChartData);
        setTimeout(() => {
          renderOrgChart(orgChartData);
        }, 100);
      } catch (err) {
        setError(err.message);
        console.error('Error processing file:', err);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading the file');
      setLoading(false);
    };

    // Use different reading method for CSV vs Excel
    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const renderOrgChart = (data) => {
    if (!containerRef.current) return;

    try {
      // Clear previous chart
      d3.select(containerRef.current).selectAll('*').remove();

      // Log the data for debugging
      console.log('Chart data:', data);

      // Find the root node (node with no parent)
      const rootNode = data.find(node => !node.parentId);
      if (!rootNode) {
        throw new Error('No root node found in the data');
      }

      // Build a proper hierarchical structure
      const idToNodeMap = {};
      data.forEach(node => {
        idToNodeMap[node.id] = { ...node, children: [] };
      });

      // Connect children to parents
      data.forEach(node => {
        if (node.parentId && idToNodeMap[node.parentId]) {
          idToNodeMap[node.parentId].children.push(idToNodeMap[node.id]);
        }
      });

      // Calculate the width based on the number of nodes at each level
      const levels = {};
      const countNodesByLevel = (node, level = 0) => {
        levels[level] = (levels[level] || 0) + 1;
        if (node.children) {
          node.children.forEach(child => countNodesByLevel(child, level + 1));
        }
      };
      countNodesByLevel(idToNodeMap[rootNode.id]);

      const maxNodesAtLevel = Math.max(...Object.values(levels));
      const nodeWidth = 220; // Width of each node
      const nodeHeight = 100; // Height of each node
      const horizontalSpacing = 60; // Space between nodes horizontally
      const verticalSpacing = 80; // Space between levels

      // Calculate minimum width needed based on maximum nodes at any level
      const minWidth = maxNodesAtLevel * (nodeWidth + horizontalSpacing);
      const chartWidth = Math.max(1600, minWidth); // Minimum width of 1600px

      const chart = new OrgChart();

      chart
        .container(containerRef.current)
        .svgWidth(chartWidth)
        .svgHeight(800)
        .nodeWidth(() => nodeWidth)
        .nodeHeight(() => nodeHeight)
        .childrenMargin(() => 80)
        .compactMarginBetween(() => 80)
        .compactMarginPair(() => 80)
        .siblingsMargin(() => 100)
        .nodeId((d) => d.id)
        .parentNodeId((d) => d.parentId)
        .buttonContent(() => '')
        .compact(false) // Disable compact mode to ensure all nodes are shown
        .linkUpdate(function(d, i, arr) {
          d3.select(this)
            .attr("stroke", "#c7c7c7")
            .attr("stroke-width", 2);
        })
        .nodeContent(function(d, i, arr, state) {
          const depth = d.depth || 0;
          const color = levelColors[depth] || levelColors.default;
          return `
            <div style="
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              border-radius: 4px;
              background-color: white;
              border-top: 4px solid ${color};
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            ">
              <div style="
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 8px;
                color: #333;
                text-align: center;
                padding: 0 8px;
              ">${d.data.name}</div>
              <div style="
                font-size: 13px;
                color: #666;
                text-align: center;
                padding: 0 8px;
                white-space: normal;
              ">${d.data.title}</div>
            </div>
          `;
        });

      // Use the flat data structure which works better with this library
      chart.data(data);
      
      // Force expand all nodes
      chart.expandAll();
      
      chart.render();
      
      chartRef.current = chart;
    } catch (err) {
      setError('Error rendering the chart: ' + err.message);
      console.error('Error rendering chart:', err);
    }
  };

  const downloadSvg = () => {
    if (!containerRef.current) return;

    try {
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) {
        throw new Error('No SVG element found');
      }

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'org-chart.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error downloading the SVG');
      console.error('Error downloading SVG:', err);
    }
  };

  return (
    <div className="excel-to-svg-container">
      <div className="upload-section">
        <div className="file-input-container">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="file-input"
            id="file-upload"
          />
          {selectedFile && (
            <div className="selected-file">
              Selected file: {selectedFile.name}
            </div>
          )}
        </div>
        {chartData && !loading && !error && (
          <button onClick={downloadSvg} className="download-button">
            Download SVG
          </button>
        )}
      </div>
      
      {loading && (
        <div className="loading">
          Processing file...
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="chart-container">
        <div
          ref={containerRef}
          style={{
            width: '100%',
            minWidth: '1600px', // Added minimum width
            height: '800px',
            border: chartData ? '1px solid #ccc' : 'none',
            borderRadius: '4px',
            marginTop: '20px',
            display: loading ? 'none' : 'block',
            overflow: 'auto',
          }}
        />
      </div>
    </div>
  );
};

export default ExcelToSvg; 