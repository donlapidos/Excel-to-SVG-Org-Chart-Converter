import React, { useState, useEffect } from 'react';
import { read } from 'xlsx';
import FileUploader from './FileUploader';
import SheetSelector from './SheetSelector';
import ChartRenderer from './ChartRenderer';
import { processData } from '../../utils/excelUtils';
import { handleDownload } from '../../utils/exportUtils';
import './ExcelProcessor.css';

/**
 * Main container component for Excel processing and chart visualization
 */
const ExcelProcessor = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [processedChartData, setProcessedChartData] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (file) {
      readFile();
    }
  }, [file]);

  const handleFileUpload = (uploadedFile) => {
    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setProcessedChartData({});
    setSelectedSheets([]);
  };

  const readFile = async () => {
    try {
      setProcessing(true);
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const sheetList = workbook.SheetNames;
      setSheets(sheetList);
      setProcessing(false);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      setError('Failed to read the Excel file. Please try again.');
      setProcessing(false);
    }
  };

  const handleGenerateChart = async () => {
    if (!file || selectedSheets.length === 0) {
      setError('Please select an Excel file and at least one sheet.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    try {
      setError(null);
      setSuccess(null);
      setProcessing(true);
      
      const data = await file.arrayBuffer();
      const workbook = read(data);
      
      // Process all selected sheets at once with the workbook
      const chartData = await processData(workbook, selectedSheets);
      
      setProcessedChartData(chartData);
      setSuccess('Chart generated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error generating chart:', err);
      setError('Failed to generate chart. Please check your Excel file format.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = (format, sheetName) => {
    // If no sheet specified, use the first selected sheet
    const targetSheet = sheetName || selectedSheets[0];
    
    if (!processedChartData || !targetSheet) {
      setError('No chart data available to export');
      return;
    }
    
    try {
      console.log(`Starting export for sheet "${targetSheet}" in ${format} format`);
      
      if (format === 'pdf') {
        // For PDF, we pass the data directly to handleDownload
        handleDownload(null, processedChartData, targetSheet, format, fileName);
      } else {
        // For SVG and PNG, we need the DOM container
        const chartRenderer = document.querySelector('.chart-renderer');
        if (!chartRenderer) {
          setError('Chart renderer element not found');
          return;
        }
        
        handleDownload(chartRenderer, processedChartData, targetSheet, format, fileName);
      }
      
      setSuccess(`Chart exported as ${format.toUpperCase()} successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setError(`Failed to export chart: ${error.message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const hasChartData = Object.keys(processedChartData).length > 0;

  return (
    <div className="excel-processor-container">
      <div className="excel-processor-controls">
        <div className="file-selector-section">
          <FileUploader onFileUpload={handleFileUpload} file={file} />
        </div>
        
        {sheets.length > 0 && (
          <div className="sheet-selector-section">
            <SheetSelector
              sheets={sheets}
              selectedSheets={selectedSheets}
              onSheetSelect={setSelectedSheets}
              isDisabled={processing}
            />
            
            <div className="process-button-container">
              <button
                className="process-button"
                onClick={handleGenerateChart}
                disabled={processing || selectedSheets.length === 0}
              >
                {processing ? 'Processing...' : 'Generate Charts'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Status messages and charts section */}
      <div className="excel-processor-results">
        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}
        
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
        
        {hasChartData && (
          <div className="charts-container">
            <ChartRenderer 
              chartData={processedChartData}
              selectedSheets={selectedSheets}
              onExport={handleExport}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelProcessor; 