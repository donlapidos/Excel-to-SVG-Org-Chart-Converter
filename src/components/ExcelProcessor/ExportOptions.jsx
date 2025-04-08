import React from 'react';
import PropTypes from 'prop-types';

/**
 * Component for chart export options
 */
const ExportOptions = ({ exportFormat, onExportFormatChange, onExport, disabled }) => {
  const handleFormatChange = (e) => {
    onExportFormatChange(e.target.value);
  };
  
  return (
    <div className="export-options">
      <div className="export-format-selector">
        <select 
          id="export-format"
          value={exportFormat}
          onChange={handleFormatChange}
          disabled={disabled}
          aria-label="Export format"
        >
          <option value="svg">SVG</option>
          <option value="png">PNG</option>
          <option value="pdf">PDF</option>
        </select>
      </div>
      
      <button 
        className="export-button"
        onClick={onExport}
        disabled={disabled}
        aria-label="Export chart"
      >
        Export
      </button>
    </div>
  );
};

ExportOptions.propTypes = {
  exportFormat: PropTypes.string.isRequired,
  onExportFormatChange: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

ExportOptions.defaultProps = {
  disabled: false,
  exportFormat: 'svg'
};

export default ExportOptions; 