import * as XLSX from 'xlsx';

/**
 * Find column names regardless of case
 * @param {Object} row - Row data from Excel sheet
 * @param {String} columnName - Column name to find
 * @returns {*} Column value or null if not found
 */
export const findColumn = (row, columnName) => {
  const key = Object.keys(row).find(key => key.toLowerCase() === columnName.toLowerCase());
  return key ? row[key] : null;
};

/**
 * Main processing function that converts workbook data to chart data
 * @param {Object} workbook - XLSX workbook data
 * @param {Array} selectedSheets - Array of sheet names to process
 * @returns {Object} Object with chart data for each selected sheet
 */
export const processData = async (workbook, selectedSheets) => {
  if (!workbook || !selectedSheets || selectedSheets.length === 0) {
    throw new Error('Missing workbook data or sheet selection');
  }

  const processedData = {};

  // Process each selected sheet
  for (const sheetName of selectedSheets) {
    try {
      // Get raw data from sheet
      const sheetData = processSheetData(workbook, sheetName);
      
      // Create consolidated data structure for rendering
      const consolidatedData = prepareConsolidatedData(sheetData);
      
      // Store processed data for this sheet
      processedData[sheetName] = consolidatedData.length > 0 ? consolidatedData : sheetData;
    } catch (error) {
      console.error(`Error processing sheet "${sheetName}":`, error);
      // Store error information
      processedData[sheetName] = { error: error.message };
    }
  }

  return processedData;
};

/**
 * Processes sheet data and transforms it into chart-compatible format
 * @param {Object} jsonData - XLSX parsed data
 * @param {String} sheetName - Name of sheet to process
 * @returns {Object} Processed data ready for chart rendering
 */
export const processSheetData = (jsonData, sheetName) => {
  const sheetData = XLSX.utils.sheet_to_json(jsonData.Sheets[sheetName]);
  console.log(`Processing sheet "${sheetName}" with ${sheetData.length} rows:`, sheetData);

  if (sheetData.length === 0) {
    throw new Error(`Sheet "${sheetName}" appears to be empty`);
  }

  // Transform data for org chart
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

  // Create a more robust parentId relationship mapping
  // First, create the name-to-id mapping
  const nameToId = {};
  orgChartData.forEach(item => {
    if (item.name) {
      nameToId[item.name.trim()] = item.id;
    }
  });
  
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
  
  return orgChartData;
};

/**
 * Reads an Excel or CSV file and extracts data
 * @param {File} file - The file to read
 * @returns {Promise} Promise resolving to parsed XLSX data
 */
export const readExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileType = file.name.split('.').pop().toLowerCase();
    
    reader.onload = (e) => {
      try {
        let jsonData;
        
        if (fileType === 'csv') {
          const csvData = e.target.result;
          jsonData = XLSX.read(csvData, { type: 'binary' });
        } else {
          const data = new Uint8Array(e.target.result);
          jsonData = XLSX.read(data, { type: 'array' });
        }
        
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading the file'));
    };
    
    if (fileType === 'csv') {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Prepares hierarchical data for the org chart with consolidated structure
 * @param {Array} data - Raw org chart data
 * @returns {Array} Data with consolidated direct reports
 */
export const prepareConsolidatedData = (data) => {
  if (!data || data.length === 0) {
    return [];
  }
  
  // Find the root node (node with no parent)
  const rootNode = data.find(node => !node.parentId);
  if (!rootNode) {
    console.error('No root node found in the data');
    return [];
  }
  
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
        name: '', // Empty string for name
        title: '', // Empty string for title, removing the manager name completely
        parentId: manager.id,
        _directReports: individualReports,
        isConsolidated: true
      };
      
      consolidatedData.push(consolidatedNode);
    }
  };
  
  // Start with the root node
  addManagerAndDirectReports(rootNode);
  
  return consolidatedData;
}; 