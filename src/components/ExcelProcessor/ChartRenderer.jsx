import React, { useRef, useEffect, useState } from 'react';
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

  // Select the first sheet when data changes
  useEffect(() => {
    if (selectedSheets.length > 0 && chartData) {
      setCurrentSheet(selectedSheets[0]);
    }
  }, [selectedSheets, chartData]);

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
      
      // Create chart instance
      const chart = createOrgChart(containerRef.current);
      
      // Set default node content renderer
      chart.nodeContent(defaultNodeContent);
      
      // Store chart reference for later use (e.g., export)
      chartRef.current = chart;
      
      // Render the chart
      chart
        .data(data)
        .render();
        
      // Expand all nodes
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
  }, [currentSheet, chartData]);

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
        <h3 className="chart-title">
          {currentSheet ? `Organization Chart: ${currentSheet}` : 'Organization Chart'}
        </h3>
        
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
        style={{ width: '100%', height: '700px', position: 'relative' }}
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