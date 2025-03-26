import React from 'react';
import ExcelToSvg from './components/ExcelToSvg';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Organizational Chart Generator</h1>
        <p className="app-subtitle">Create professional organization charts from Excel or CSV files</p>
      </header>
      
      <main className="app-main">
        <div className="app-description">
          <h2>How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Upload Excel or CSV</h3>
                <p>Select your file with organizational data</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Select Sheets</h3>
                <p>Choose which sheets to transform into charts</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Download Charts</h3>
                <p>Export as SVG, PDF, or PNG formats</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="app-tool">
          <ExcelToSvg />
        </div>
      </main>
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Required Columns</h3>
            <ul className="footer-list">
              <li><strong>Name</strong> - Person's name</li>
              <li><strong>Title</strong> - Job title</li>
              <li><strong>Reports To</strong> - Manager's name</li>
            </ul>
            <p className="footer-note">Column names are case-insensitive</p>
          </div>
          
          <div className="footer-section">
            <h3>Multiple Sheet Support</h3>
            <p>For Excel files with multiple sheets, you can:</p>
            <ul className="footer-list">
              <li>Process multiple sheets at once</li>
              <li>Export all selected sheets as a single PDF</li>
              <li>Navigate between sheets with the chart controls</li>
            </ul>
          </div>
        </div>
        
        <div className="copyright">
          © {new Date().getFullYear()} Organization Chart Generator
        </div>
      </footer>
    </div>
  );
}

export default App;
