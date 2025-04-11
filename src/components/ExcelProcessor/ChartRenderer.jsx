import React, { useRef, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import * as d3 from 'd3';
import { createOrgChart, defaultNodeContent, clearContainer, validateChartData } from '../../utils/chartUtils';
import ExportOptions from './ExportOptions';

/**
 * Component for rendering the organizational chart
 */
const ChartRenderer = ({ 
  chartData, 
  selectedSheets,
  onExport 
}) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [currentSheet, setCurrentSheet] = useState(null);
  const [error, setError] = useState(null);
  const [exportFormat, setExportFormat] = useState('svg');
  const [departmentCount, setDepartmentCount] = useState(0);
  const [isLargeChart, setIsLargeChart] = useState(false);

  // Select the first sheet when data changes
  useEffect(() => {
    if (selectedSheets.length > 0 && chartData) {
      setCurrentSheet(selectedSheets[0]);
    }
  }, [selectedSheets, chartData]);

  // Process chart data to analyze size and complexity
  const chartStats = useMemo(() => {
    if (!chartData || !currentSheet) return null;
    
    const data = chartData[currentSheet];
    if (!data || !Array.isArray(data)) return null;
    
    const numNodes = data.length;
    const deptNodes = data.filter(node => node.isDepartment).length;
    const levels = new Set();
    
    // Determine max depth for performance optimization
    const findMaxDepth = (nodeId, currentDepth = 0) => {
      levels.add(currentDepth);
      const children = data.filter(node => node.parentId === nodeId);
      if (children.length === 0) return currentDepth;
      
      return Math.max(...children.map(child => findMaxDepth(child.id, currentDepth + 1)));
    };
    
    // Find root node to start depth calculation
    const rootNode = data.find(node => !node.parentId);
    const maxDepth = rootNode ? findMaxDepth(rootNode.id) : 0;
    
    // Check if this is a large chart that might need performance optimization
    const isLarge = numNodes > 100 || maxDepth > 5 || deptNodes > 10;
    
    return {
      totalNodes: numNodes,
      departmentNodes: deptNodes,
      maxDepth,
      levels: levels.size,
      isLarge
    };
  }, [chartData, currentSheet]);

  // Render chart when current sheet changes
  useEffect(() => {
    if (!containerRef.current || !chartData || !currentSheet) return;
    
    const data = chartData[currentSheet];
    if (!data) return;
    
    // Clear any previous chart and error
    clearContainer(containerRef.current);
    setError(null);
    
    // Validate data
    const errorMessage = validateChartData(data);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    
    try {
      console.log(`Rendering org chart for "${currentSheet}" with ${data.length} nodes`);
      
      // Update department count for display
      const departments = data.filter(node => node.isDepartment);
      setDepartmentCount(departments.length);
      
      // Check if this is a large chart
      const isLarge = chartStats?.isLarge || false;
      setIsLargeChart(isLarge);
      
      // Create chart instance
      const chart = createOrgChart(
        containerRef.current, 
        // For large charts, increase the canvas size
        isLarge ? 2000 : 1600, 
        isLarge ? 1000 : 800
      );
      
      // Set default node content renderer
      chart.nodeContent(defaultNodeContent);
      
      // Performance optimizations for large charts
      if (isLarge) {
        chart
          .compact(true)
          .siblingsMargin(() => 30)
          .childrenMargin(() => 40);
      }
      
      // Store chart reference for later use (e.g., export)
      chartRef.current = chart;
      
      // Render the chart
      chart
        .data(data)
        .render();
        
      // Expand all nodes with a delay to ensure proper rendering
      setTimeout(() => {
        try {
          chart.expandAll();
        } catch (err) {
          console.error('Error expanding nodes:', err);
        }
      }, 1000);
    } catch (err) {
      console.error('Error rendering chart:', err);
      setError(`Error rendering chart: ${err.message}`);
    }
  }, [currentSheet, chartData, chartStats]);

  // Sheet selection UI
  const renderSheetTabs = () => {
    if (!selectedSheets || selectedSheets.length <= 1) return null;
    
    return (
      <div className="sheet-tabs">
        {selectedSheets.map(sheet => (
          <button
            key={sheet}
            className={`sheet-tab ${sheet === currentSheet ? 'active' : ''}`}
            onClick={() => setCurrentSheet(sheet)}
          >
            {sheet}
          </button>
        ))}
      </div>
    );
  };

  // Handle export format change
  const handleExportFormatChange = (format) => {
    setExportFormat(format);
  };

  // Handle export button click
  const handleExport = () => {
    if (!onExport || !currentSheet) {
      console.error('Export failed: Missing export handler or no sheet selected');
      return;
    }
    
    console.log(`Exporting ${currentSheet} as ${exportFormat}`);
    onExport(exportFormat, currentSheet);
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        d3.select(containerRef.current).selectAll('*').remove();
      }
    };
  }, []);

  return (
    <div className="chart-renderer">
      <div className="chart-header">
        <div className="chart-header-left">
          <h3 className="chart-title">
            {currentSheet ? `Organization Chart: ${currentSheet}` : 'Organization Chart'}
          </h3>
          
          {chartStats && (
            <div className="chart-stats">
              <span className="stat-item">
                <span className="stat-label">Total Nodes:</span> {chartStats.totalNodes}
              </span>
              
              {departmentCount > 0 && (
                <span className="stat-item">
                  <span className="stat-label">Departments:</span> {departmentCount}
                </span>
              )}
              
              {isLargeChart && (
                <span className="stat-item large-indicator">
                  Large Chart
                </span>
              )}
            </div>
          )}
        </div>
        
        <ExportOptions 
          onExportFormatChange={handleExportFormatChange}
          onExport={handleExport}
          exportFormat={exportFormat}
          disabled={!chartData || Object.keys(chartData).length === 0}
        />
      </div>
      
      {renderSheetTabs()}
      
      <div 
        className="chart-content"
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: isLargeChart ? '800px' : '700px',
          position: 'relative',
          overflowX: 'auto',
          overflowY: 'auto'
        }}
      >
        {error && (
          <div className="chart-error">
            {error}
          </div>
        )}
        
        {!chartData && (
          <div className="no-data-message">
            No chart data available. Please select and process a sheet.
          </div>
        )}
      </div>
    </div>
  );
};

ChartRenderer.propTypes = {
  chartData: PropTypes.object,
  selectedSheets: PropTypes.array.isRequired,
  onExport: PropTypes.func
};

export default ChartRenderer; 