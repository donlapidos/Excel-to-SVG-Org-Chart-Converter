import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './ExcelProcessor.css';

/**
 * Component for selecting Excel sheets to process
 */
const SheetSelector = ({ sheets, selectedSheets, onSheetSelect, isDisabled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSheets, setFilteredSheets] = useState(sheets);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setFilteredSheets(
      sheets.filter(sheet => 
        sheet.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [sheets, searchTerm]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const handleSheetChange = (sheet) => {
    const updatedSelection = [...selectedSheets];
    
    if (updatedSelection.includes(sheet)) {
      // Remove from selection
      const index = updatedSelection.indexOf(sheet);
      updatedSelection.splice(index, 1);
    } else {
      // Add to selection
      updatedSelection.push(sheet);
    }
    
    onSheetSelect(updatedSelection);
  };

  const handleSelectAll = () => {
    if (selectedSheets.length === filteredSheets.length) {
      // Deselect all filtered sheets
      const newSelection = selectedSheets.filter(
        sheet => !filteredSheets.includes(sheet)
      );
      onSheetSelect(newSelection);
    } else {
      // Select all filtered sheets
      const newSelection = [
        ...new Set([...selectedSheets, ...filteredSheets])
      ];
      onSheetSelect(newSelection);
    }
  };

  // Determine select all state
  const allFilteredSelected = 
    filteredSheets.length > 0 && 
    filteredSheets.every(sheet => selectedSheets.includes(sheet));
  
  const someFilteredSelected = 
    filteredSheets.some(sheet => selectedSheets.includes(sheet)) && 
    !allFilteredSelected;

  // No sheets available
  if (sheets.length === 0) {
    return (
      <div className="sheet-selection-container">
        <div className="sheet-selection-header">
          <h3>Select Sheets</h3>
        </div>
        <div className="no-sheets-message">No sheets available in the uploaded file.</div>
      </div>
    );
  }

  return (
    <div className="sheet-selection-container">
      <div className="sheet-selection-header">
        <h3>Select Sheets</h3>
        <div className="sheet-count">
          {selectedSheets.length} of {sheets.length} selected
        </div>
      </div>

      <div className="sheet-search-container">
        <input
          ref={searchInputRef}
          type="text"
          className="sheet-search-input"
          placeholder="Search sheets..."
          value={searchTerm}
          onChange={handleSearchChange}
          disabled={isDisabled}
          aria-label="Search sheets"
        />
        {searchTerm && (
          <button
            type="button"
            className="clear-search-button"
            onClick={clearSearch}
            disabled={isDisabled}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="select-all-container">
        <div className="select-all-checkbox">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            ref={el => {
              if (el) {
                el.indeterminate = someFilteredSelected;
              }
            }}
            onChange={handleSelectAll}
            disabled={isDisabled || filteredSheets.length === 0}
            id="select-all"
          />
          <label htmlFor="select-all" className="select-all-checkbox-custom"></label>
        </div>
        <label htmlFor="select-all" className="select-all-text">
          Select All {searchTerm ? 'Filtered' : ''} Sheets
        </label>
      </div>

      <div className="sheet-list">
        {filteredSheets.length > 0 ? (
          filteredSheets.map(sheet => (
            <div
              key={sheet}
              className={`sheet-item ${selectedSheets.includes(sheet) ? 'selected' : ''}`}
              onClick={() => !isDisabled && handleSheetChange(sheet)}
            >
              <div className="sheet-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSheets.includes(sheet)}
                  onChange={() => handleSheetChange(sheet)}
                  disabled={isDisabled}
                  id={`sheet-${sheet}`}
                />
                <label htmlFor={`sheet-${sheet}`} className="sheet-checkbox-custom"></label>
              </div>
              <span className="sheet-name" title={sheet}>{sheet}</span>
            </div>
          ))
        ) : (
          <div className="no-sheets-message">
            No sheets matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};

SheetSelector.propTypes = {
  sheets: PropTypes.array.isRequired,
  selectedSheets: PropTypes.array.isRequired,
  onSheetSelect: PropTypes.func.isRequired,
  isDisabled: PropTypes.bool
};

SheetSelector.defaultProps = {
  isDisabled: false
};

export default SheetSelector; 