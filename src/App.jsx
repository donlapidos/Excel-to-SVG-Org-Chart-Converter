import React from 'react';
import ExcelToSvg from './components/ExcelToSvg';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Excel to SVG Org Chart Converter</h1>
      </header>
      <main className="app-main">
        <ExcelToSvg />
      </main>
      <footer className="app-footer">
        <p>Upload an Excel (.xlsx, .xls) or CSV file with columns: Name, Title, Reports To</p>
        <p className="footer-note">Note: Column names are case-insensitive</p>
      </footer>
    </div>
  );
}

export default App;
