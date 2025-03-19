# Excel to SVG Org Chart Converter

A React-based web application that converts Excel (.xlsx, .xls) and CSV files into SVG organizational charts with customizable styling.

## Features

- Upload Excel (.xlsx, .xls) or CSV files
- Case-insensitive column name matching
- Automatic hierarchy detection
- Color-coded organizational levels
- Custom styling for nodes
- SVG download functionality
- Responsive design

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/YOUR_USERNAME/excel-to-svg-org-chart.git
   cd excel-to-svg-org-chart
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

## Usage

1. Prepare your Excel or CSV file with the following columns:
   - Name: The name of the person
   - Title: The person's job title
   - Reports To: The name of the person's manager

   Note: Column names are case-insensitive.

2. Upload your file using the file input.
3. The organizational chart will render automatically.
4. Download the chart as an SVG file using the "Download SVG" button.

## Technologies Used

- React
- Vite
- d3-org-chart
- SheetJS (xlsx)
- CSS3

## License

MIT
