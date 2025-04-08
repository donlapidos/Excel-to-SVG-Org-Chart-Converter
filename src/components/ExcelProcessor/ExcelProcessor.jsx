import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import SheetSelector from './SheetSelector';
import ExportOptions from './ExportOptions';
import '../../css/ExcelProcessor.css';

const ExcelProcessor = ({ onDataProcessed }) => {
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get all sheet names
          const sheetList = workbook.SheetNames.map((name, index) => ({
            name,
            index,
            data: workbook.Sheets[name]
          }));
          
          setFile(selectedFile);
          setSheets(sheetList);
          setSelectedSheets([]);
          setCurrentSheetIndex(null);
          setProcessingStatus('');
        } catch (error) {
          console.error("Error reading Excel file:", error);
          alert("Failed to read the Excel file. Please ensure it's a valid Excel file.");
        }
      };
      
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleSelectSheet = (sheetIndices) => {
    setSelectedSheets(Array.isArray(sheetIndices) ? sheetIndices : 
      selectedSheets.includes(sheetIndices) 
        ? selectedSheets.filter(idx => idx !== sheetIndices)
        : [...selectedSheets, sheetIndices]);
  };

  const handleProcessSheets = async () => {
    if (selectedSheets.length === 0) return;
    
    setIsProcessing(true);
    setProcessingStatus('processing');
    
    try {
      // Process each selected sheet
      const processedData = selectedSheets.map(index => {
        const sheet = sheets[index];
        const sheetData = XLSX.utils.sheet_to_json(sheet.data, { header: 1 });
        
        // Find header row and column positions
        const headerRowIndex = findHeaderRow(sheetData);
        
        if (headerRowIndex === -1) {
          throw new Error(`Could not find header row in sheet: ${sheet.name}`);
        }
        
        const headerRow = sheetData[headerRowIndex];
        const colIndexes = {
          name: headerRow.findIndex(col => /name/i.test(String(col))),
          title: headerRow.findIndex(col => /title|position/i.test(String(col))),
          department: headerRow.findIndex(col => /department/i.test(String(col))),
          manager: headerRow.findIndex(col => /manager|reports to/i.test(String(col))),
        };
        
        // Check if essential columns are found
        if (colIndexes.name === -1 || colIndexes.manager === -1) {
          throw new Error(`Missing required columns in sheet: ${sheet.name}`);
        }
        
        // Extract and transform data
        const employees = [];
        for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
          const row = sheetData[i];
          if (!row[colIndexes.name]) continue; // Skip rows without names
          
          employees.push({
            id: generateId(row[colIndexes.name]),
            name: row[colIndexes.name],
            title: colIndexes.title !== -1 ? row[colIndexes.title] || '' : '',
            department: colIndexes.department !== -1 ? row[colIndexes.department] || '' : '',
            manager: row[colIndexes.manager] || ''
          });
        }
        
        return {
          name: sheet.name,
          data: employees
        };
      });
      
      // Update state with all processed data
      onDataProcessed(processedData);
      setCurrentSheetIndex(0); // Show first sheet
      setProcessingStatus('success');
    } catch (error) {
      console.error("Error processing sheets:", error);
      setProcessingStatus('error');
      alert(`Error processing sheets: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheets([]);
    setCurrentSheetIndex(null);
    setProcessingStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePrevSheet = () => {
    if (currentSheetIndex > 0) {
      setCurrentSheetIndex(currentSheetIndex - 1);
    }
  };

  const handleNextSheet = () => {
    if (currentSheetIndex < selectedSheets.length - 1) {
      setCurrentSheetIndex(currentSheetIndex + 1);
    }
  };

  // Helper function to find the header row in a sheet
  const findHeaderRow = (data) => {
    // Look for rows that might contain column headers
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      // Check if this row has strings like "name", "title", "manager", etc.
      const headerLikeTerms = ['name', 'title', 'position', 'manager', 'department', 'reports'];
      const matches = headerLikeTerms.filter(term => 
        row.some(cell => cell && String(cell).toLowerCase().includes(term))
      );
      
      if (matches.length >= 2) { // If at least 2 header terms match
        return i;
      }
    }
    return -1; // Header row not found
  };

  // Generate a unique ID from a name string
  const generateId = (name) => {
    return `emp_${name.replace(/\s+/g, '_').toLowerCase()}_${Math.random().toString(36).substr(2, 5)}`;
  };

  return (
    <div className="excel-processor-container">
      <div className="file-management">
        <div className="file-input-container">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="file-input"
            id="excel-file-input"
            ref={fileInputRef}
          />
          <label htmlFor="excel-file-input" className="file-input-label">
            Choose Excel File
          </label>
          
          {file && (
            <div className="selected-file">
              <span className="file-name">{file.name}</span>
              <button className="clear-file-btn" onClick={handleClearFile}>×</button>
            </div>
          )}
        </div>

        {sheets.length > 0 && (
          <SheetSelector
            sheets={sheets}
            selectedSheets={selectedSheets}
            onSelectSheet={handleSelectSheet}
            onProcessSheets={handleProcessSheets}
            isProcessing={isProcessing}
            currentSheetIndex={currentSheetIndex}
            onPrevSheet={handlePrevSheet}
            onNextSheet={handleNextSheet}
            processingStatus={processingStatus}
          />
        )}
      </div>

      {processingStatus === 'success' && (
        <ExportOptions currentSheetIndex={currentSheetIndex} />
      )}
    </div>
  );
};

export default ExcelProcessor; 