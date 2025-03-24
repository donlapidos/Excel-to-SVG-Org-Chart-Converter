import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { OrgChart } from 'd3-org-chart';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const ExcelToSvg = () => {
  const [file, setFile] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('svg'); // Default to SVG
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // Color scheme for different levels
  const levelColors = {
    0: '#ff7043', // Orange for top level
    1: '#29b6f6', // Light blue for second level
    2: '#66bb6a', // Green for third level
    3: '#42a5f5', // Blue for fourth level
    default: '#90caf9' // Default light blue
  };

  // Helper function to find column names regardless of case
  const findColumn = (row, columnName) => {
    const key = Object.keys(row).find(key => key.toLowerCase() === columnName.toLowerCase());
    return key ? row[key] : null;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFile(file);
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
      data.forEach(node => {
        let depth = 0;
        let currentId = node.id;
        while (currentId) {
          const parent = data.find(n => n.id === data.find(p => p.id === currentId)?.parentId);
          if (parent) {
            depth++;
            currentId = parent.id;
          } else {
            break;
          }
        }
        levels[depth] = (levels[depth] || 0) + 1;
      });

      const maxNodesAtLevel = Math.max(...Object.values(levels));
      const nodeWidth = 220; // Width of each node
      const nodeHeight = 100; // Height of each node
      const horizontalSpacing = 60; // Space between nodes horizontally

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
        .linkUpdate(function() {
          d3.select(this)
            .attr("stroke", "#c7c7c7")
            .attr("stroke-width", 2);
        })
        .nodeContent(function(d) {
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

  const handleDownload = async () => {
    try {
      if (!chartRef.current) {
        throw new Error('Chart is not available');
      }

      const svgEl = containerRef.current.querySelector('svg');
      if (!svgEl) {
        throw new Error('SVG element not found');
      }

      if (selectedFormat === 'svg') {
        // Export as SVG (original functionality)
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = svgUrl;
        downloadLink.download = 'org-chart.svg';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(svgUrl);
      } else if (selectedFormat === 'png') {
        // For PNG export, use a more direct approach
        setError('Preparing PNG, please wait...');
        
        try {
          // Clone the chart container to avoid modifying the original
          const container = containerRef.current.cloneNode(true);
          document.body.appendChild(container);
          container.style.position = 'absolute';
          container.style.top = '-9999px';
          container.style.backgroundColor = 'white';
          
          // Use html2canvas with the cloned container
          const canvas = await html2canvas(container, {
            backgroundColor: '#FFFFFF',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          
          // Clean up the cloned container
          document.body.removeChild(container);
          
          // Get PNG data
          const pngUrl = canvas.toDataURL('image/png');
          
          // Download PNG
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = 'org-chart.png';
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          setError(null);
        } catch (err) {
          setError('Error creating PNG: ' + err.message);
          console.error('Error in PNG generation:', err);
        }
      } else if (selectedFormat === 'pdf') {
        // For PDF, use PNG approach first and then convert to PDF
        setError('Preparing PDF, please wait...');
        
        try {
          // Clone the chart container
          const container = containerRef.current.cloneNode(true);
          document.body.appendChild(container);
          container.style.position = 'absolute';
          container.style.top = '-9999px';
          container.style.backgroundColor = 'white';
          
          // Use html2canvas with the cloned container
          const canvas = await html2canvas(container, {
            backgroundColor: '#FFFFFF',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          
          // Clean up the cloned container
          document.body.removeChild(container);
          
          // Set up PDF orientation based on canvas dimensions
          const orientation = canvas.width > canvas.height ? 'l' : 'p';
          
          // Create PDF with proper dimensions
          const pdf = new jsPDF(orientation, 'mm', 'a4');
          
          // Calculate PDF dimensions
          const pageWidth = orientation === 'l' ? 297 : 210;
          
          // Calculate image dimensions to fit the page
          const ratio = canvas.height / canvas.width;
          const imgWidth = pageWidth - 20; // 10mm margins on each side
          const imgHeight = imgWidth * ratio;
          
          // Add the image to the PDF centered on the page
          pdf.addImage(
            canvas.toDataURL('image/jpeg', 1.0),
            'JPEG',
            10, // Left margin
            10, // Top margin
            imgWidth,
            imgHeight
          );
          
          // Save the PDF
          pdf.save('org-chart.pdf');
          
          setError(null);
        } catch (err) {
          setError('Error creating PDF: ' + err.message);
          console.error('Error in PDF generation:', err);
        }
      }
    } catch (err) {
      setError('Error downloading chart: ' + err.message);
      console.error('Error downloading chart:', err);
    }
  };

  const handleFormatChange = (event) => {
    setSelectedFormat(event.target.value);
  };

  return (
    <div className="excel-to-svg-container">
      <div className="upload-section">
        <div className="file-input-container">
          <label className="file-input">
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <span>Choose Excel or CSV File</span>
          </label>
          {file && <div className="selected-file">Selected file: {file.name}</div>}
        </div>
        {chartData && !loading && !error && (
          <div className="download-options">
            <div className="format-selector">
              <label htmlFor="format-select">Export Format:</label>
              <select 
                id="format-select" 
                value={selectedFormat} 
                onChange={handleFormatChange}
                className="format-select"
              >
                <option value="svg">SVG</option>
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
              </select>
            </div>
            <button onClick={handleDownload} className="download-button">
              Download as {selectedFormat.toUpperCase()}
            </button>
          </div>
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