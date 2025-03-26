import React, { useRef, useState, useEffect } from 'react';
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
  
  // New state for multiple sheets support
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [sheetChartData, setSheetChartData] = useState({}); // Store chart data for each sheet
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [processedSheets, setProcessedSheets] = useState({}); // Track which sheets have been processed

  // Debug useEffect to log state changes
  useEffect(() => {
    console.log("Available sheets:", availableSheets);
    console.log("Selected sheets:", selectedSheets);
    console.log("Current sheet index:", currentSheetIndex);
    console.log("Processed sheets:", processedSheets);
  }, [availableSheets, selectedSheets, currentSheetIndex, processedSheets]);

  // Color scheme for different levels
  const levelColors = {
    0: '#2563EB', // Primary blue for top level
    1: '#1E40AF', // Dark blue for second level
    2: '#4F46E5', // Indigo for third level
    3: '#3B82F6', // Light blue for fourth level
    default: '#93C5FD' // Default lighter blue
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
    setSheetChartData({});
    setProcessedSheets({});
    setAvailableSheets([]);
    setSelectedSheets([]);
    setCurrentSheetIndex(0);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let jsonData;
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType === 'csv') {
          // Handle CSV files - only one sheet
          const csvData = e.target.result;
          jsonData = XLSX.read(csvData, { type: 'binary' });
          
          // For CSV, there's only one sheet to process
          const sheets = [jsonData.SheetNames[0]];
          setAvailableSheets(sheets);
          setSelectedSheets(sheets);
          
          // Process the CSV sheet immediately
          processSheet(jsonData, jsonData.SheetNames[0]);
        } else {
          // Handle Excel files - possibly multiple sheets
          const data = new Uint8Array(e.target.result);
          jsonData = XLSX.read(data, { type: 'array' });
          
          // Get all available sheets
          const sheets = jsonData.SheetNames;
          console.log("Excel file sheets:", sheets);
          
          // Force re-render by setting state in the next tick
          setTimeout(() => {
            setAvailableSheets(sheets);
            
            if (sheets.length > 0) {
              setSelectedSheets([sheets[0]]); // Default select first sheet
              processSheet(jsonData, sheets[0]);
            }
          }, 0);
        }
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

  // Process a specific sheet
  const processSheet = (jsonData, sheetName) => {
    try {
      // Mark sheet as processed or processing
      setProcessedSheets(prev => ({ ...prev, [sheetName]: 'processing' }));
      
      const sheetData = XLSX.utils.sheet_to_json(jsonData.Sheets[sheetName]);
      console.log(`Processing sheet "${sheetName}" with ${sheetData.length} rows:`, sheetData);

      if (sheetData.length === 0) {
        throw new Error(`Sheet "${sheetName}" appears to be empty`);
      }

      // Simplified data transformation with better error handling
      const orgChartData = sheetData.map((row, index) => {
        const name = findColumn(row, 'name') || '';
        const title = findColumn(row, 'title') || '';
        const reportsTo = findColumn(row, 'reports to') || '';
        
        if (!name) {
          console.warn(`Row ${index} has no name in sheet "${sheetName}"`);
        }
        
        return {
          id: index.toString(),
          name,
          title,
          reportsTo
        };
      });

      console.log(`Transformed data for sheet "${sheetName}":`, orgChartData);

      // Create a more robust parentId relationship mapping
      // First, create the name-to-id mapping
      const nameToId = {};
      orgChartData.forEach(item => {
        if (item.name) {
          nameToId[item.name.trim()] = item.id;
        }
      });
      
      console.log(`Name to ID mapping for sheet "${sheetName}":`, nameToId);
      
      // Then assign parent IDs
      orgChartData.forEach(item => {
        if (item.reportsTo) {
          const parentName = item.reportsTo.trim();
          item.parentId = nameToId[parentName];
          
          if (!item.parentId) {
            console.warn(`Could not find parent "${parentName}" for "${item.name}" in sheet "${sheetName}"`);
          }
        } else {
          item.parentId = null; // Explicitly set to null for root node
        }
        
        // Clean up the temporary field
        delete item.reportsTo;
      });
      
      // Verify relationships
      const rootNodes = orgChartData.filter(node => !node.parentId);
      console.log(`Found ${rootNodes.length} root nodes in sheet "${sheetName}":`, rootNodes);
      
      if (rootNodes.length === 0) {
        console.warn(`No root nodes found in sheet "${sheetName}". Check if all nodes have a "Reports To" value.`);
      } else if (rootNodes.length > 1) {
        console.warn(`Multiple root nodes found in sheet "${sheetName}". This may cause rendering issues.`);
      }
      
      // Check for orphaned nodes
      const orphans = orgChartData.filter(node => 
        node.parentId && !orgChartData.some(p => p.id === node.parentId)
      );
      
      if (orphans.length > 0) {
        console.warn(`Found ${orphans.length} orphaned nodes in sheet "${sheetName}" (nodes with invalid parent references):`, orphans);
      }

      // Store this sheet's data
      setSheetChartData(prev => ({ 
        ...prev, 
        [sheetName]: orgChartData 
      }));
      
      // Mark as successfully processed
      setProcessedSheets(prev => ({ ...prev, [sheetName]: 'done' }));
      
      // If this is the first or only sheet, update the current data and render it
      if (selectedSheets.length === 1 || selectedSheets[0] === sheetName) {
        setChartData(orgChartData);
        setTimeout(() => {
          renderOrgChart(orgChartData, sheetName);
        }, 100);
      }
    } catch (err) {
      console.error(`Error processing sheet "${sheetName}":`, err);
      setProcessedSheets(prev => ({ ...prev, [sheetName]: 'error' }));
      setError(`Error processing sheet "${sheetName}": ${err.message}`);
    }
  };

  // Handle sheet selection
  const handleSheetSelection = (sheetName) => {
    console.log(`Sheet selection changed for: ${sheetName}`);
    setSelectedSheets(prev => {
      const newSelection = prev.includes(sheetName)
        ? prev.filter(sheet => sheet !== sheetName)
        : [...prev, sheetName];
        
      console.log("New sheet selection:", newSelection);
      
      // If we're removing the current sheet, we need to change the view
      if (prev.includes(sheetName) && !newSelection.includes(sheetName) && 
          selectedSheets[currentSheetIndex] === sheetName) {
        // Find a new sheet to display
        if (newSelection.length > 0) {
          const newIndex = 0;
          setCurrentSheetIndex(newIndex);
          const newSheetName = newSelection[newIndex];
          
          setTimeout(() => {
            if (sheetChartData[newSheetName]) {
              setChartData(sheetChartData[newSheetName]);
              renderOrgChart(sheetChartData[newSheetName], newSheetName);
            } else if (file) {
              // Process the sheet if not already processed
              processSheetByName(newSheetName);
            }
          }, 0);
        } else {
          // No sheets selected, clear the chart
          setChartData(null);
          d3.select(containerRef.current).selectAll('*').remove();
        }
      }
      
      return newSelection;
    });
  };

  // Select or deselect all sheets
  const handleBulkSelection = (selectAll) => {
    if (selectAll) {
      const allSheets = [...availableSheets];
      setSelectedSheets(allSheets);
      
      // If we just selected all sheets and had none before, display the first one
      if (selectedSheets.length === 0 && allSheets.length > 0) {
        setTimeout(() => {
          setCurrentSheetIndex(0);
          const sheetName = allSheets[0];
          if (sheetChartData[sheetName]) {
            setChartData(sheetChartData[sheetName]);
            renderOrgChart(sheetChartData[sheetName], sheetName);
          } else {
            // Need to process this sheet
            processSheetByName(sheetName);
          }
        }, 0);
      }
    } else {
      // Clear the chart when deselecting all
      setSelectedSheets([]);
      setChartData(null);
      d3.select(containerRef.current).selectAll('*').remove();
    }
  };

  // Process a sheet by name - utility function
  const processSheetByName = (sheetName) => {
    if (!file) return;
    
    const fileType = file.name.split('.').pop().toLowerCase();
    
    if (fileType === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvData = e.target.result;
        const jsonData = XLSX.read(csvData, { type: 'binary' });
        processSheet(jsonData, sheetName);
      };
      reader.readAsBinaryString(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const jsonData = XLSX.read(data, { type: 'array' });
        processSheet(jsonData, sheetName);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Change the displayed sheet
  const handleSheetChange = (index) => {
    console.log(`Changing to sheet index: ${index}`);
    if (index >= 0 && index < selectedSheets.length) {
      setCurrentSheetIndex(index);
      const sheetName = selectedSheets[index];
      console.log(`Loading sheet: ${sheetName}`);
      
      // If sheet data exists, render it
      if (sheetChartData[sheetName]) {
        console.log(`Found cached data for sheet: ${sheetName}`);
        setChartData(sheetChartData[sheetName]);
        setTimeout(() => {
          renderOrgChart(sheetChartData[sheetName], sheetName);
        }, 0);
      } 
      // If sheet hasn't been processed yet, process it
      else if (file && !processedSheets[sheetName]) {
        console.log(`No cached data, processing sheet: ${sheetName}`);
        // Process this sheet
        processSheetByName(sheetName);
      }
    }
  };

  // Navigate to previous sheet
  const handlePrevSheet = () => {
    if (currentSheetIndex > 0) {
      handleSheetChange(currentSheetIndex - 1);
    }
  };

  // Navigate to next sheet
  const handleNextSheet = () => {
    if (currentSheetIndex < selectedSheets.length - 1) {
      handleSheetChange(currentSheetIndex + 1);
    }
  };

  // Process all selected sheets
  const processAllSelectedSheets = () => {
    if (!file || selectedSheets.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    console.log(`Processing ${selectedSheets.length} selected sheets`);
    
    // Read the file once and process all sheets
    const fileType = file.name.split('.').pop().toLowerCase();
    
    const handleFileRead = (jsonData) => {
      let processedCount = 0;
      
      // Process each selected sheet
      for (const sheetName of selectedSheets) {
        try {
          processSheet(jsonData, sheetName);
        } catch (err) {
          console.error(`Error processing sheet "${sheetName}":`, err);
          setProcessedSheets(prev => ({ ...prev, [sheetName]: 'error' }));
        } finally {
          processedCount++;
          if (processedCount === selectedSheets.length) {
            setTimeout(() => setLoading(false), 100);
            
            // Display the first selected sheet after all processing is complete
            if (selectedSheets.length > 0) {
              setCurrentSheetIndex(0);
              const firstSheet = selectedSheets[0];
              
              setTimeout(() => {
                if (sheetChartData[firstSheet]) {
                  setChartData(sheetChartData[firstSheet]);
                  renderOrgChart(sheetChartData[firstSheet], firstSheet);
                }
              }, 200);
            }
          }
        }
      }
    };
    
    // Read file data
    if (fileType === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvData = e.target.result;
        const jsonData = XLSX.read(csvData, { type: 'binary' });
        handleFileRead(jsonData);
      };
      reader.readAsBinaryString(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const jsonData = XLSX.read(data, { type: 'array' });
        handleFileRead(jsonData);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const renderOrgChart = (data, sheetTitle = '') => {
    if (!containerRef.current) return;
    console.log(`Rendering org chart for sheet: ${sheetTitle} with ${data?.length || 0} nodes`);

    try {
      // Clear previous chart
      d3.select(containerRef.current).selectAll('*').remove();

      // Validate data
      if (!data || data.length === 0) {
        console.error("No data available to render chart");
        setError("No data available to render chart");
        return;
      }

      // Find the root node (node with no parent)
      const rootNode = data.find(node => !node.parentId);
      if (!rootNode) {
        const errorMsg = 'No root node found in the data. Make sure there is one person who does not report to anyone.';
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      console.log(`Root node found: ${rootNode.name}`);

      // Get all nodes that report to a specific manager
      const getDirectReports = (managerId) => {
        return data.filter(node => node.parentId === managerId);
      };

      // Create a new dataset with consolidated structure
      const consolidatedData = [];
      
      // Function to add a manager and their direct reports to the consolidated data
      const addManagerAndDirectReports = (manager) => {
        // Add the manager node
        consolidatedData.push({...manager});
        
        // Get direct reports for this manager
        const directReports = getDirectReports(manager.id);
        console.log(`Manager ${manager.name} has ${directReports.length} direct reports`);
        
        // Split direct reports into those who have their own reports (managers) and those who don't
        const managerReports = directReports.filter(report => getDirectReports(report.id).length > 0);
        const individualReports = directReports.filter(report => getDirectReports(report.id).length === 0);
        
        // Process each manager report recursively
        managerReports.forEach(managerReport => {
          addManagerAndDirectReports(managerReport);
        });
        
        // If there are individual reports, create a consolidated node for them
        if (individualReports.length > 0) {
          const consolidatedNode = {
            id: `consolidated_${manager.id}`,
            name: '',
            title: '',
            parentId: manager.id,
            _directReports: individualReports
          };
          
          consolidatedData.push(consolidatedNode);
        }
      };
      
      // Start with the root node
      addManagerAndDirectReports(rootNode);
      console.log(`Consolidated data has ${consolidatedData.length} nodes`);

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
                padding: 16px 12px;
                box-sizing: border-box;
                overflow: hidden;
              ">`;
            
            directReports.forEach((report, index) => {
              content += `
                <div style="
                  width: 100%;
                  margin-top: ${index > 0 ? '18px' : '0'};
                  padding-top: ${index > 0 ? '18px' : '0'};
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

      // Add sheet title if provided
      if (sheetTitle) {
        // Add a title to the chart
        d3.select(containerRef.current)
          .select('svg')
          .append('text')
          .attr('x', chartWidth / 2)
          .attr('y', 30)
          .attr('text-anchor', 'middle')
          .attr('font-size', '20px')
          .attr('font-weight', 'bold')
          .attr('fill', '#333')
          .text(sheetTitle);
      }

      // Use the consolidated data structure
      chart.data(consolidatedData);
      
      // Force expand all nodes
      chart.expandAll();
      
      chart.render();
      
      chartRef.current = chart;
      console.log("Chart rendered successfully");
    } catch (err) {
      setError('Error rendering the chart: ' + err.message);
      console.error('Error rendering chart:', err);
    }
  };

  const handleDownload = async () => {
    try {
      if (!chartRef.current && selectedSheets.length === 0) {
        throw new Error('Chart is not available');
      }

      // Check if we should export current chart or multiple sheets
      const multipleSheets = selectedSheets.length > 1;
      
      // If exporting a single chart, make sure SVG element exists
      if (!multipleSheets) {
        const svgEl = containerRef.current.querySelector('svg');
        if (!svgEl) {
          throw new Error('SVG element not found');
        }
      }

      if (selectedFormat === 'svg') {
        if (multipleSheets) {
          setError('SVG export is available for one chart at a time. Please select only one sheet or choose PDF format for multiple sheets.');
          return;
        }
        
        // Export as SVG (original functionality)
        const svgEl = containerRef.current.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = svgUrl;
        const sheetName = selectedSheets[currentSheetIndex] || 'org-chart';
        downloadLink.download = `${sheetName}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(svgUrl);
      } else if (selectedFormat === 'png') {
        if (multipleSheets) {
          setError('PNG export is available for one chart at a time. Please select only one sheet or choose PDF format for multiple sheets.');
          return;
        }
        
        // Show loading message
        setError(`Preparing PNG, please wait...`);
        
        // Export as PNG (existing functionality)
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
            
          // Set data and render for current sheet
          const currentSheetName = selectedSheets[currentSheetIndex];
          const currentData = sheetChartData[currentSheetName];
          
          // Add title
          const titleEl = document.createElement('h2');
          titleEl.textContent = currentSheetName;
          titleEl.style.textAlign = 'center';
          titleEl.style.fontFamily = 'Arial, sans-serif';
          titleEl.style.color = '#333';
          tempContainer.appendChild(titleEl);

          // Set data and render
          exportChart.data(currentData);
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
              downloadLink.download = `${currentSheetName}.png`;
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
          // Create a new PDF document (landscape for wider org charts)
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          
          // Define starting position and dimensions
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          // Process each selected sheet
          for (let i = 0; i < selectedSheets.length; i++) {
            const sheetName = selectedSheets[i];
            
            // Add a new page if not the first sheet
            if (i > 0) {
              pdf.addPage();
            }
            
            // Add title for the sheet
            pdf.setFontSize(16);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Organizational Chart - ${sheetName}`, pageWidth / 2, 10, { align: 'center' });
            
            // Get chart data for this sheet
            const chartData = sheetChartData[sheetName];
            if (!chartData) {
              console.warn(`No data available for sheet ${sheetName}, skipping...`);
              continue;
            }

            // Generate PDF content for this sheet
            const margin = 10;
            const availableWidth = pageWidth - (margin * 2);
            const availableHeight = pageHeight - (margin * 2) - 10; // Account for title
            
            // Find the root node
            const rootNode = chartData.find(node => !node.parentId);
            if (!rootNode) {
              console.warn(`No root node found in sheet ${sheetName}, skipping...`);
              continue;
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
            
            // Calculate appropriate box size based on chart complexity
            const numNodesWidest = Math.max(...Object.values(nodesByLevel).map(level => level.length));
            
            // Dynamically calculate box dimensions to fit the entire chart on one page
            // More levels or nodes = smaller boxes
            const boxWidth = Math.min(60, availableWidth / (numNodesWidest + 1));
            const verticalSpace = availableHeight - 5; // space after title
            const boxHeight = Math.min(25, verticalSpace / (maxLevel + 2)); // +2 for margins
            
            const horizontalSpacing = Math.min(15, (availableWidth - (boxWidth * numNodesWidest)) / Math.max(1, numNodesWidest - 1));
            const verticalSpacing = Math.min(35, (verticalSpace - (boxHeight * (maxLevel + 1))) / Math.max(1, maxLevel));
            
            let startY = margin + 15; // Start position after title
            
            // Track node positions for drawing connections
            const nodePositions = {};
            
            // Draw nodes level by level
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
                const numDirectReports = node._directReports ? node._directReports.length : 0;
                // Adjust box height for consolidated nodes, but ensure it doesn't exceed the page
                const totalBoxHeight = node._directReports && numDirectReports > 0
                  ? Math.min(boxHeight + (numDirectReports * 12), boxHeight * 3)
                  : boxHeight;
                
                // Draw node box with colored top border
                pdf.setFillColor(255, 255, 255);
                pdf.roundedRect(currentX, levelY, boxWidth, totalBoxHeight, 1, 1, 'F');
                
                // Draw the colored top border
                pdf.setFillColor(r, g, b);
                pdf.roundedRect(currentX, levelY, boxWidth, 2, 1, 1, 'F');
                
                const textX = currentX + (boxWidth / 2);
                
                // If this is a consolidated node with direct reports
                if (node._directReports && node._directReports.length > 0) {
                  // Calculate appropriate font size and spacing based on number of reports
                  const fontSize = Math.max(5, 7 - Math.floor(numDirectReports / 3));
                  const nameSize = fontSize;
                  const titleSize = Math.max(4, fontSize - 1);
                  const itemSpacing = Math.max(5, 8 - Math.floor(numDirectReports / 2));
                  
                  // Start position for first item
                  let reportY = levelY + 6;
                  
                  // Draw each direct report in the consolidated box
                  node._directReports.forEach((report, idx) => {
                    // Add separator if not the first report
                    if (idx > 0) {
                      pdf.setDrawColor(240, 240, 240);
                      pdf.setLineWidth(0.1);
                      pdf.line(currentX + 2, reportY - 2, currentX + boxWidth - 2, reportY - 2);
                    }
                    
                    // Name
                    pdf.setFont(undefined, 'bold');
                    pdf.setFontSize(nameSize);
                    pdf.setTextColor(70, 70, 70);
                    pdf.text(report.name, textX, reportY, { 
                      align: 'center',
                      maxWidth: boxWidth - 4
                    });
                    reportY += nameSize * 0.5;
                    
                    // Title
                    pdf.setFont(undefined, 'normal');
                    pdf.setFontSize(titleSize);
                    pdf.setTextColor(120, 120, 120);
                    pdf.text(report.title || '', textX, reportY, { 
                      align: 'center',
                      maxWidth: boxWidth - 4
                    });
                    reportY += itemSpacing;
                  });
                } else {
                  // Regular node - add name with better formatting
                  // Adjust font size based on available space
                  const nameSize = Math.min(8, boxWidth / 10);
                  const titleSize = Math.max(6, nameSize - 1);
                  
                  pdf.setFontSize(nameSize);
                  pdf.setTextColor(0, 0, 0);
                  pdf.setFont(undefined, 'bold');
                  
                  // Handle name with line breaks for long names
                  pdf.text(node.name, textX, levelY + 6, { 
                    align: 'center',
                    maxWidth: boxWidth - 2
                  });
                  
                  // Add title
                  pdf.setFontSize(titleSize);
                  pdf.setTextColor(100, 100, 100);
                  pdf.setFont(undefined, 'normal');
                  
                  // Handle title with line breaks
                  pdf.text(node.title || '', textX, levelY + 10, { 
                    align: 'center',
                    maxWidth: boxWidth - 2
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
            }
            
            // Draw connections between nodes
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.3);
            
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
                pdf.line(startX, startY, startX, startY + (verticalSpacing / 3));
                
                // Draw horizontal line to align with child's x position
                pdf.line(startX, startY + (verticalSpacing / 3), endX, startY + (verticalSpacing / 3));
                
                // Draw vertical line to child
                pdf.line(endX, startY + (verticalSpacing / 3), endX, endY);
              }
            });
          }
          
          // Save the PDF with all sheets
          const filename = file ? file.name.replace(/\.[^/.]+$/, '') : 'org-charts';
          pdf.save(`${filename}.pdf`);
          setError(null);
          
        } catch (err) {
          console.error('Error creating PDF:', err);
          setError(`Error creating PDF: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      setError('Error downloading chart: ' + err.message);
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
          {file && <div className="selected-file">{file.name}</div>}
        </div>
      </div>
        
      {/* Sheet Management Section */}
      <div className="sheet-management">
        {/* Sheet Selection UI - Enhanced with better visual design */}
        {availableSheets.length >= 1 && (
          <div className="sheet-selection">
            <h3>
              Available Sheets
              <span>{availableSheets.length}</span>
            </h3>
            
            <div className="sheet-selection-actions">
              <button 
                onClick={() => handleBulkSelection(true)}
                className="sheet-action-button"
              >
                Select All Sheets
              </button>
              <button 
                onClick={() => handleBulkSelection(false)}
                className="sheet-action-button"
              >
                Clear Selection
              </button>
            </div>
            
            <div className="sheet-list">
              {availableSheets.map(sheet => (
                <div key={sheet} className="sheet-item">
                  <label className="sheet-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSheets.includes(sheet)}
                      onChange={() => handleSheetSelection(sheet)}
                    />
                    <span>{sheet}</span>
                  </label>
                  <span className={`sheet-status ${processedSheets[sheet]}`}>
                    {processedSheets[sheet] === 'done' && '✓'}
                    {processedSheets[sheet] === 'processing' && '⟳'}
                    {processedSheets[sheet] === 'error' && '✗'}
                  </span>
                </div>
              ))}
            </div>
            
            {selectedSheets.length > 0 && (
              <button 
                onClick={processAllSelectedSheets}
                className="process-sheets-button"
              >
                Process {selectedSheets.length} Selected Sheet{selectedSheets.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
        
        {/* Chart Navigation - Enhanced with better visual design */}
        {selectedSheets.length > 1 && chartData && (
          <div className="chart-navigation">
            <button 
              onClick={handlePrevSheet}
              disabled={currentSheetIndex === 0}
              className="nav-button"
            >
              &laquo; Previous
            </button>
            
            <div className="sheet-indicator">
              <div className="current-sheet-label">VIEWING SHEET</div>
              <div className="current-sheet-name">{selectedSheets[currentSheetIndex]}</div>
              <div className="sheet-counter">{currentSheetIndex + 1} of {selectedSheets.length}</div>
            </div>
            
            <button 
              onClick={handleNextSheet}
              disabled={currentSheetIndex === selectedSheets.length - 1}
              className="nav-button"
            >
              Next &raquo;
            </button>
          </div>
        )}
        
        {/* Chart title for single sheet scenario */}
        {selectedSheets.length === 1 && chartData && !loading && (
          <div className="current-sheet-display">
            <h3>Current Chart: {selectedSheets[0]}</h3>
          </div>
        )}
        
        {/* Download Options Section - Enhanced with better visual design */}
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
              {(selectedFormat === 'svg' || selectedFormat === 'png') && selectedSheets.length > 1 && (
                <span className="format-note">
                  {selectedFormat.toUpperCase()} export works with one sheet at a time
                </span>
              )}
            </div>
            <button onClick={handleDownload} className="download-button">
              Download as {selectedFormat.toUpperCase()}
              {selectedSheets.length > 1 && selectedFormat === 'pdf' ? ' (All Selected)' : ''}
            </button>
          </div>
        )}
      </div>
      
      {/* Status Messages */}
      {loading && (
        <div className="loading">
          Processing file data...
        </div>
      )}
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {/* Chart Container with Title Bar */}
      <div className="chart-container">
        {chartData && selectedSheets.length > 0 && (
          <div className="chart-title-bar">
            <h2>{selectedSheets[currentSheetIndex]} Organization Chart</h2>
          </div>
        )}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            minWidth: '1600px',
            height: '800px',
            border: chartData ? '1px solid #e5e7eb' : 'none',
            borderRadius: '0 0 8px 8px',
            marginTop: 0,
            display: loading ? 'none' : 'block',
            overflow: 'auto',
            backgroundColor: 'white',
            boxShadow: chartData ? '0 2px 10px rgba(0, 0, 0, 0.1)' : 'none'
          }}
        />
      </div>
    </div>
  );
};

export default ExcelToSvg; 