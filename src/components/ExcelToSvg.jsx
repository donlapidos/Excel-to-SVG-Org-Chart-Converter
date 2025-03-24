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

      // Get all nodes that report to a specific manager
      const getDirectReports = (managerId) => {
        return data.filter(node => node.parentId === managerId);
      };

      // Create a new dataset with consolidated structure
      const consolidatedData = [];
      
      // Add the root node (e.g., Mike Kraft)
      consolidatedData.push({
        ...rootNode
      });
      
      // Find managers (those with direct reports)
      const middleManagers = data.filter(node => 
        node.parentId === rootNode.id && 
        getDirectReports(node.id).length > 0
      );
      
      // Add each middle manager (e.g., Sergei West)
      middleManagers.forEach(manager => {
        consolidatedData.push({
          ...manager
        });
        
        // For each middle manager, create a consolidated node for all their direct reports
        const directReports = getDirectReports(manager.id);
        
        if (directReports.length > 0) {
          // Create a single consolidated node that contains all direct reports
          const consolidatedNode = {
            id: `consolidated_${manager.id}`,
            name: '',  // No single name for the node
            title: '',
            parentId: manager.id,
            _directReports: directReports
          };
          
          consolidatedData.push(consolidatedNode);
        }
      });

      // Calculate the width based on the number of nodes
      const nodeWidth = 220;
      const nodeHeight = 120;
      
      // Calculate chart dimensions
      const chartWidth = 1600;
      const chartHeight = 800;

      const chart = new OrgChart();

      chart
        .container(containerRef.current)
        .svgWidth(chartWidth)
        .svgHeight(chartHeight)
        .nodeWidth(() => nodeWidth)
        .nodeHeight(d => {
          // If this is a consolidated node with direct reports
          if (d.data._directReports && d.data._directReports.length > 0) {
            // Calculate height based on number of direct reports
            // Base height + additional height per direct report
            // Increased space for each report to prevent overflow
            return Math.max(nodeHeight, 50 + d.data._directReports.length * 60);
          }
          return nodeHeight;
        })
        .childrenMargin(() => 60)
        .compactMarginBetween(() => 40)
        .compactMarginPair(() => 60) 
        .siblingsMargin(() => 40)
        .nodeId((d) => d.id)
        .parentNodeId((d) => d.parentId)
        .buttonContent(() => '')
        .compact(false)
        .layout('top')
        .linkUpdate(function() {
          d3.select(this)
            .attr("stroke", "#c7c7c7")
            .attr("stroke-width", 2);
        })
        .nodeContent(function(d) {
          const depth = d.depth || 0;
          const color = levelColors[depth] || levelColors.default;
          const directReports = d.data._directReports || [];
          
          // If this is a consolidated node with direct reports
          if (directReports.length > 0) {
            // Create a box with stacked direct reports
            let content = `
              <div style="
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border-radius: 4px;
                background-color: white;
                border-top: 4px solid ${levelColors[2]};
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                padding: 12px;
                box-sizing: border-box;
                overflow: hidden;
              ">`;
            
            directReports.forEach((report, index) => {
              content += `
                <div style="
                  width: 100%;
                  margin-top: ${index > 0 ? '12px' : '0'};
                  padding-top: ${index > 0 ? '12px' : '0'};
                  border-top: ${index > 0 ? '1px solid #f0f0f0' : 'none'};
                ">
                  <div style="
                    font-weight: bold;
                    font-size: 14px;
                    color: #444;
                    text-align: center;
                    margin-bottom: 4px;
                  ">${report.name}</div>
                  <div style="
                    font-size: 12px;
                    color: #777;
                    text-align: center;
                  ">${report.title}</div>
                </div>
              `;
            });
            
            content += `</div>`;
            return content;
          } else {
            // Regular node with name and title
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
                padding: 16px 12px;
                box-sizing: border-box;
              ">
                <div style="
                  font-weight: bold;
                  font-size: 16px;
                  margin-bottom: 6px;
                  color: #333;
                  text-align: center;
                  width: 100%;
                ">${d.data.name}</div>
                <div style="
                  font-size: 13px;
                  color: #666;
                  text-align: center;
                  width: 100%;
                ">${d.data.title}</div>
              </div>`;
          }
        });

      // Use the consolidated data structure
      chart.data(consolidatedData);
      
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
        // Show loading message
        setError(`Preparing PNG, please wait...`);
        
        try {
          // Create a temporary version of the chart container for export
          const tempContainer = document.createElement('div');
          tempContainer.style.position = 'fixed';
          tempContainer.style.top = '0';
          tempContainer.style.left = '0';
          tempContainer.style.width = '1600px';
          tempContainer.style.height = '800px';
          tempContainer.style.backgroundColor = 'white';
          tempContainer.style.zIndex = '10000';
          document.body.appendChild(tempContainer);
          
          // Create a new chart renderer in the temporary container
          const exportChart = new OrgChart();
          
          exportChart
            .container(tempContainer)
            .svgWidth(1600)
            .svgHeight(800)
            .nodeWidth(() => 220)
            .nodeHeight(d => {
              // If this is a consolidated node with direct reports
              if (d.data._directReports && d.data._directReports.length > 0) {
                // Calculate height based on number of direct reports
                return Math.max(120, 50 + d.data._directReports.length * 60);
              }
              return 120;
            })
            .childrenMargin(() => 60)
            .compactMarginBetween(() => 40)
            .compactMarginPair(() => 60)
            .siblingsMargin(() => 40)
            .nodeId((d) => d.id)
            .parentNodeId((d) => d.parentId)
            .buttonContent(() => '')
            .compact(false)
            .layout('top')
            .linkUpdate(function() {
              d3.select(this)
                .attr("stroke", "#c7c7c7")
                .attr("stroke-width", 2);
            })
            .nodeContent(function(d) {
              const depth = d.depth || 0;
              const color = levelColors[depth] || levelColors.default;
              const directReports = d.data._directReports || [];
              
              // If this is a consolidated node with direct reports
              if (directReports.length > 0) {
                // Create a box with stacked direct reports
                let content = `
                  <div style="
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    border-radius: 4px;
                    background-color: white;
                    border-top: 4px solid ${levelColors[2]};
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    padding: 12px;
                    box-sizing: border-box;
                    overflow: hidden;
                  ">`;
                
                directReports.forEach((report, index) => {
                  content += `
                    <div style="
                      width: 100%;
                      margin-top: ${index > 0 ? '12px' : '0'};
                      padding-top: ${index > 0 ? '12px' : '0'};
                      border-top: ${index > 0 ? '1px solid #f0f0f0' : 'none'};
                    ">
                      <div style="
                        font-weight: bold;
                        font-size: 14px;
                        color: #444;
                        text-align: center;
                        margin-bottom: 4px;
                      ">${report.name}</div>
                      <div style="
                        font-size: 12px;
                        color: #777;
                        text-align: center;
                      ">${report.title}</div>
                    </div>
                  `;
                });
                
                content += `</div>`;
                return content;
              } else {
                // Regular node with name and title
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
                    padding: 16px 12px;
                    box-sizing: border-box;
                  ">
                    <div style="
                      font-weight: bold;
                      font-size: 16px;
                      margin-bottom: 6px;
                      color: #333;
                      text-align: center;
                      width: 100%;
                    ">${d.data.name}</div>
                    <div style="
                      font-size: 13px;
                      color: #666;
                      text-align: center;
                      width: 100%;
                    ">${d.data.title}</div>
                  </div>`;
              }
            });
            
          // Set data and render
          exportChart.data(chartRef.current.data());
          exportChart.expandAll();
          exportChart.render();
          
          // Give the chart time to render
          setTimeout(async () => {
            try {
              // Use html2canvas to create a PNG
              const canvas = await html2canvas(tempContainer, {
                backgroundColor: 'white',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: true
              });
              
              // Remove the temporary container
              document.body.removeChild(tempContainer);
              
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
              console.error('Error creating PNG:', err);
              setError(`Error creating PNG: ${err.message}`);
              document.body.removeChild(tempContainer);
            }
          }, 1000);
        } catch (err) {
          console.error('Error preparing PNG:', err);
          setError(`Error preparing PNG: ${err.message}`);
        }
      } else if (selectedFormat === 'pdf') {
        // Show loading message
        setError(`Preparing PDF, please wait...`);
        
        try {
          // Get the data from the chart
          const chartData = chartRef.current.data();
          
          // Create a new PDF document (landscape for wider org charts)
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          
          // Define starting position and dimensions
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 10;
          const availableWidth = pageWidth - (margin * 2);
          
          // Add title
          pdf.setFontSize(18);
          pdf.text('Organizational Chart', pageWidth / 2, margin + 5, { align: 'center' });
          
          // Find the root node
          const rootNode = chartData.find(node => !node.parentId);
          if (!rootNode) {
            throw new Error('No root node found');
          }
          
          // Function to organize nodes by level
          const organizeByLevel = () => {
            const levels = {};
            
            // First determine levels for all nodes (breadth-first traversal)
            const setLevel = (nodeId, level) => {
              if (!levels[level]) {
                levels[level] = [];
              }
              
              const node = chartData.find(n => n.id === nodeId);
              if (node) {
                levels[level].push(node);
                
                // Process children
                chartData
                  .filter(n => n.parentId === nodeId)
                  .forEach(child => setLevel(child.id, level + 1));
              }
            };
            
            // Start with root node at level 0
            setLevel(rootNode.id, 0);
            
            return levels;
          };
          
          // Get nodes organized by level
          const nodesByLevel = organizeByLevel();
          const maxLevel = Math.max(...Object.keys(nodesByLevel).map(Number));
          
          // Set box dimensions
          const boxWidth = 70;
          const boxHeight = 30;
          const horizontalSpacing = 20;
          const verticalSpacing = 50;
          let startY = margin + 15; // Start position after title
          
          // Track node positions for drawing connections
          const nodePositions = {};
          
          // Draw nodes level by level
          let maxY = startY;
          
          for (let level = 0; level <= maxLevel; level++) {
            const nodes = nodesByLevel[level] || [];
            if (nodes.length === 0) continue;
            
            // Calculate width needed for this level
            const levelWidth = nodes.length * boxWidth + (nodes.length - 1) * horizontalSpacing;
            const startX = margin + (availableWidth - levelWidth) / 2;
            
            // Draw each node in this level
            let currentX = startX;
            const levelY = startY + (level * (boxHeight + verticalSpacing));
            
            nodes.forEach(node => {
              // Use level colors
              let levelColor;
              if (node.id.startsWith('consolidated_')) {
                levelColor = levelColors[2]; // Use level 2 color for consolidated box
              } else {
                levelColor = levelColors[level] || levelColors.default;
              }
              
              const hexColor = levelColor.substring(1); // Remove #
              const r = parseInt(hexColor.substring(0, 2), 16);
              const g = parseInt(hexColor.substring(2, 4), 16);
              const b = parseInt(hexColor.substring(4, 6), 16);
              
              // Calculate box height based on if it's a consolidated node
              const totalBoxHeight = node._directReports && node._directReports.length > 0
                ? boxHeight + (node._directReports.length * 20)
                : boxHeight;
              
              // Draw node box with colored top border
              pdf.setFillColor(255, 255, 255);
              pdf.roundedRect(currentX, levelY, boxWidth, totalBoxHeight, 1, 1, 'F');
              
              // Draw the colored top border
              pdf.setFillColor(r, g, b);
              pdf.roundedRect(currentX, levelY, boxWidth, 4, 1, 1, 'F');
              
              const textX = currentX + (boxWidth / 2);
              
              // If this is a consolidated node with direct reports
              if (node._directReports && node._directReports.length > 0) {
                // Add more space for the first report
                let reportY = levelY + 12;
                
                // Draw each direct report in the consolidated box
                node._directReports.forEach((report, idx) => {
                  // Add separator if not the first report
                  if (idx > 0) {
                    pdf.setDrawColor(240, 240, 240);
                    pdf.setLineWidth(0.2);
                    pdf.line(currentX + 5, reportY - 5, currentX + boxWidth - 5, reportY - 5);
                  }
                  
                  // Name
                  pdf.setFont(undefined, 'bold');
                  pdf.setFontSize(9);
                  pdf.setTextColor(70, 70, 70);
                  pdf.text(report.name, textX, reportY, { 
                    align: 'center',
                    maxWidth: boxWidth - 6
                  });
                  reportY += 7;
                  
                  // Title
                  pdf.setFont(undefined, 'normal');
                  pdf.setFontSize(7);
                  pdf.setTextColor(120, 120, 120);
                  pdf.text(report.title || '', textX, reportY, { 
                    align: 'center',
                    maxWidth: boxWidth - 6
                  });
                  reportY += 12;
                });
              } else {
                // Regular node - add name with better formatting
                pdf.setFontSize(10);
                pdf.setTextColor(0, 0, 0);
                pdf.setFont(undefined, 'bold');
                
                // Handle name with line breaks for long names
                pdf.text(node.name, textX, levelY + 12, { 
                  align: 'center',
                  maxWidth: boxWidth - 4
                });
                
                // Add title
                pdf.setFontSize(8);
                pdf.setTextColor(100, 100, 100);
                pdf.setFont(undefined, 'normal');
                
                // Handle title with line breaks
                pdf.text(node.title || '', textX, levelY + 20, { 
                  align: 'center',
                  maxWidth: boxWidth - 4
                });
              }
              
              // Store node position for drawing connections
              nodePositions[node.id] = {
                x: currentX + (boxWidth / 2),
                y: levelY,
                height: totalBoxHeight
              };
              
              // Move to next position
              currentX += boxWidth + horizontalSpacing;
            });
            
            maxY = Math.max(maxY, levelY + boxHeight);
          }
          
          // Draw connections between nodes
          pdf.setDrawColor(199, 199, 199);
          pdf.setLineWidth(0.5);
          
          chartData.forEach(node => {
            if (node.parentId && nodePositions[node.id] && nodePositions[node.parentId]) {
              const child = nodePositions[node.id];
              const parent = nodePositions[node.parentId];
              
              // Draw line from parent bottom to child top
              const startX = parent.x;
              const startY = parent.y + parent.height;
              const endX = child.x;
              const endY = child.y;
              
              // Draw vertical line down from parent
              pdf.line(startX, startY, startX, startY + (verticalSpacing / 2));
              
              // Draw horizontal line to align with child's x position
              pdf.line(startX, startY + (verticalSpacing / 2), endX, startY + (verticalSpacing / 2));
              
              // Draw vertical line to child
              pdf.line(endX, startY + (verticalSpacing / 2), endX, endY);
            }
          });
          
          // Check if we need multiple pages
          if (maxY > pageHeight - margin) {
            pdf.addPage();
            // Could implement continuing the chart on next page if needed
          }
          
          // Save the PDF
          pdf.save('org-chart.pdf');
          setError(null);
        } catch (err) {
          console.error('Error creating PDF:', err);
          setError(`Error creating PDF: ${err.message}`);
          setTimeout(() => {
            alert(`Error creating PDF: ${err.message}\nCheck console for details.`);
          }, 100);
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      setError('Error downloading chart: ' + err.message);
      setTimeout(() => {
        alert(`Error downloading chart: ${err.message}\nCheck console for details.`);
      }, 100);
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
            display: loading ? 'none' : 'block'
          }}
        />
      </div>
    </div>
  );
};

export default ExcelToSvg; 