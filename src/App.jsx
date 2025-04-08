import React from 'react';
import ExcelProcessor from './components/ExcelProcessor';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Multi-Sheet Org Chart Generator</h1>
      </header>
      
      <main className="app-main">
        <div className="app-card">
          <ExcelProcessor />
        </div>
      </main>
      
      <footer className="app-footer">
        <div className="footer-hint">
          <p><strong>Required columns:</strong> Name, Title, Reports To (case-insensitive)</p>
          <p>For Excel files: Process multiple sheets and export as PDF</p>
        </div>
        
        <div className="copyright">
          © {new Date().getFullYear()} Org Chart Generator
        </div>
      </footer>
    </div>
  );
}

export default App;
