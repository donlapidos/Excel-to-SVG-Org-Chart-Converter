import React from 'react';
import PropTypes from 'prop-types';

/**
 * Component for uploading Excel or CSV files
 */
const FileUploader = ({ onFileUpload, file }) => {
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      onFileUpload(selectedFile);
    }
  };

  return (
    <div className="file-uploader">
      <div className="file-input-container">
        <input
          type="file"
          id="file-input"
          className="file-input"
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
        />
        <label htmlFor="file-input" className="file-input-label">
          <svg className="upload-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
          </svg>
          <span className="upload-text">
            {file ? 'Change file' : 'Choose Excel or CSV file'}
          </span>
        </label>
      </div>
      
      {file && (
        <div className="file-info">
          <div className="file-details">
            <span className="file-name">{file.name}</span>
            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
          <button
            type="button"
            className="remove-file-button"
            onClick={() => onFileUpload(null)}
            aria-label="Remove file"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

FileUploader.propTypes = {
  onFileUpload: PropTypes.func.isRequired,
  file: PropTypes.object
};

export default FileUploader; 