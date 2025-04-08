import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { levelColors } from './chartUtils';

/**
 * Main export function that handles all export formats
 * @param {HTMLElement} container - The chart container (can be null for PDF exports)
 * @param {Object} chartData - The processed chart data object
 * @param {Array|String} selectedSheets - List of selected sheet names or a single sheet name
 * @param {String} format - Export format (svg, png, pdf)
 * @param {String} fileName - Base name for the exported file
 */
export const handleDownload = async (container, chartData, selectedSheets, format, fileName = 'org-chart') => {
  if (!chartData) {
    console.error('Cannot export: Missing chart data');
    return;
  }

  try {
    // Convert selectedSheets to array if it's a string
    const sheetsArray = Array.isArray(selectedSheets) ? selectedSheets : [selectedSheets];

    // For PDF exports
    if (format === 'pdf') {
      if (sheetsArray.length > 1) {
        // Handle PDF export for multiple sheets
        for (const sheetName of sheetsArray) {
          if (chartData[sheetName]) {
            await exportToPdf(chartData[sheetName], sheetName, `${fileName}-${sheetName}`);
          }
        }
      } else {
        // Single sheet PDF export
        const sheetName = sheetsArray[0];
        if (chartData[sheetName]) {
          await exportToPdf(chartData[sheetName], sheetName, fileName);
        } else {
          throw new Error(`No data found for sheet: ${sheetName}`);
        }
      }
    } else if (format === 'png') {
      // For PNG export, we need the container
      if (!container) {
        throw new Error('Container element is required for PNG export');
      }
      await exportToPng(container, fileName);
    } else {
      // Default to SVG export
      if (!container) {
        throw new Error('Container element is required for SVG export');
      }
      await exportToSvg(container, fileName);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw error; // Re-throw to be caught by the caller
  }
};

/**
 * Export the chart as an SVG file
 * @param {HTMLElement} container - The chart container
 * @param {String} filename - Name for the exported file
 */
export const exportToSvg = (container, filename = 'org-chart') => {
  return new Promise((resolve, reject) => {
    try {
      // Find the SVG element
      const svgEl = container.querySelector('svg');
      if (!svgEl) {
        throw new Error('SVG element not found');
      }
      
      // Clone the SVG to avoid modifying the original
      const svgClone = svgEl.cloneNode(true);
      
      // Ensure SVG has proper XML namespace
      if (!svgClone.getAttribute('xmlns')) {
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      if (!svgClone.getAttribute('xmlns:xlink')) {
        svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      }
      
      // Add width and height if missing
      if (!svgClone.getAttribute('width') && svgEl.getBoundingClientRect().width) {
        svgClone.setAttribute('width', svgEl.getBoundingClientRect().width);
      }
      if (!svgClone.getAttribute('height') && svgEl.getBoundingClientRect().height) {
        svgClone.setAttribute('height', svgEl.getBoundingClientRect().height);
      }
      
      // Serialize SVG to XML string with XML declaration
      const serializer = new XMLSerializer();
      const svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + 
                          serializer.serializeToString(svgClone);
      
      // Create blob with proper MIME type
      const blob = new Blob([svgContent], { 
        type: 'image/svg+xml;charset=utf-8' 
      });
      
      // Create a helper function to trigger download
      const triggerDownload = (url) => {
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${filename}.svg`;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        
        // Trigger click and remove
        downloadLink.click();
        
        // Delay removal slightly to ensure download begins
        setTimeout(() => {
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(url); // Clean up
        }, 100);
      };
      
      // Use createObjectURL for modern browsers
      const svgUrl = URL.createObjectURL(blob);
      triggerDownload(svgUrl);
      
      console.log(`SVG export completed: ${filename}.svg`);
      resolve();
    } catch (err) {
      console.error('SVG export error:', err);
      reject(err);
    }
  });
};

/**
 * Export the chart as a PNG image using html2canvas
 * @param {HTMLElement} container - The chart container
 * @param {String} filename - Name for the exported file
 * @param {Number} exportWidth - Width for the exported image
 * @param {Number} exportHeight - Height for the exported image
 */
export const exportToPng = (container, filename = 'org-chart', exportWidth = 1600, exportHeight = 900) => {
  return new Promise((resolve, reject) => {
    try {
      // Find the SVG element
      const svgEl = container.querySelector('svg');
      if (!svgEl) {
        throw new Error('SVG element not found');
      }
      
      // Create a temporary container for the chart to be captured
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = `${exportWidth}px`;
      tempContainer.style.height = `${exportHeight}px`;
      tempContainer.style.background = 'white';
      tempContainer.style.overflow = 'hidden';
      document.body.appendChild(tempContainer);
      
      // Clone the SVG into the temporary container
      const svgClone = svgEl.cloneNode(true);
      tempContainer.appendChild(svgClone);
      
      // Get chart content element for scaling
      const chartContent = svgClone.querySelector('.chart-content');
      if (chartContent) {
        // Apply optimal scaling
        const svgWidth = svgClone.clientWidth || parseInt(svgClone.getAttribute('width'));
        const svgHeight = svgClone.clientHeight || parseInt(svgClone.getAttribute('height'));
        
        if (svgWidth && svgHeight) {
          // Calculate scale to fit while maintaining aspect ratio
          const scale = Math.min(
            exportWidth / svgWidth,
            exportHeight / svgHeight
          ) * 0.9; // Add a small margin
          
          // Center the chart
          const translateX = (exportWidth - (svgWidth * scale)) / 2;
          const translateY = (exportHeight - (svgHeight * scale)) / 2;
          
          // Apply new transform
          chartContent.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
        }
      }
      
      // Wait for positioning to take effect
      setTimeout(async () => {
        try {
          // Use html2canvas with optimized settings
          const canvas = await html2canvas(tempContainer, {
            backgroundColor: 'white',
            scale: 2, // Higher resolution
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: exportWidth,
            height: exportHeight,
            windowWidth: exportWidth,
            windowHeight: exportHeight,
            onclone: (clonedDoc) => {
              // Add additional styling to ensure SVG renders properly
              const clonedContainer = clonedDoc.body.querySelector('div');
              if (clonedContainer) {
                clonedContainer.style.background = 'white';
                clonedContainer.style.width = `${exportWidth}px`;
                clonedContainer.style.height = `${exportHeight}px`;
              }
            }
          });
          
          // Get PNG data
          const pngUrl = canvas.toDataURL('image/png');
          
          // Create download link
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `${filename}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Clean up
          document.body.removeChild(tempContainer);
          resolve();
        } catch (err) {
          document.body.removeChild(tempContainer);
          reject(err);
        }
      }, 1000);
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Export the chart data to PDF
 * @param {Array} chartData - The chart data
 * @param {String} sheetName - Name of the sheet
 * @param {String} filename - Name for the exported file
 */
export const exportToPdf = (chartData, sheetName = 'Org Chart', filename = 'org-chart') => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Exporting PDF for "${sheetName}" with ${chartData.length} nodes`);
      
      // Create a new PDF document (landscape for wider org charts)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Define dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Organizational Chart - ${sheetName}`, pageWidth / 2, 10, { align: 'center' });
      
      // Validate chart data
      if (!chartData || chartData.length === 0) {
        throw new Error('No chart data available');
      }

      // Find the root node
      const rootNode = chartData.find(node => !node.parentId);
      if (!rootNode) {
        throw new Error('No root node found in the data');
      }
      
      console.log(`Root node identified: ${rootNode.name} (ID: ${rootNode.id})`);
      
      // Function to organize nodes by level
      const organizeByLevel = () => {
        const levels = {};
        
        // Determine levels for all nodes (breadth-first traversal)
        const setLevel = (nodeId, level) => {
          if (!levels[level]) {
            levels[level] = [];
          }
          
          const node = chartData.find(n => n.id === nodeId);
          if (node) {
            levels[level].push(node);
            
            // Process children
            const childNodes = chartData.filter(n => n.parentId === nodeId);
            childNodes.forEach(child => setLevel(child.id, level + 1));
            
            console.log(`Node ${node.name} at level ${level} has ${childNodes.length} children`);
          }
        };
        
        // Start with root node at level 0
        setLevel(rootNode.id, 0);
        
        return levels;
      };
      
      // Get nodes organized by level
      const nodesByLevel = organizeByLevel();
      const maxLevel = Math.max(...Object.keys(nodesByLevel).map(Number));
      
      console.log(`Chart has ${maxLevel + 1} levels, organizing layout...`);
      
      // Calculate box dimensions
      const margin = 10;
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2) - 10; // Account for title
      
      // Find the level with the most nodes
      const numNodesWidest = Math.max(...Object.values(nodesByLevel).map(level => level.length));
      
      // Calculate box dimensions to fit the chart on one page
      const boxWidth = Math.min(60, availableWidth / (numNodesWidest + 1));
      const verticalSpace = availableHeight - 5; // space after title
      const boxHeight = Math.min(25, verticalSpace / (maxLevel + 2)); // +2 for margins
      
      const horizontalSpacing = Math.min(15, (availableWidth - (boxWidth * numNodesWidest)) / Math.max(1, numNodesWidest - 1));
      const verticalSpacing = Math.min(35, (verticalSpace - (boxHeight * (maxLevel + 1))) / Math.max(1, maxLevel));
      
      let startY = margin + 15; // Start position after title
      
      // Track node positions for drawing connections
      const nodePositions = {};
      
      console.log(`Drawing ${Object.keys(nodesByLevel).length} levels of nodes`);
      
      // Draw nodes level by level
      for (let level = 0; level <= maxLevel; level++) {
        const nodes = nodesByLevel[level] || [];
        if (nodes.length === 0) continue;
        
        console.log(`Drawing level ${level} with ${nodes.length} nodes`);
        
        // Calculate width needed for this level
        const levelWidth = nodes.length * boxWidth + (nodes.length - 1) * horizontalSpacing;
        const startX = margin + (availableWidth - levelWidth) / 2;
        
        // Draw each node in this level
        let currentX = startX;
        const levelY = startY + (level * (boxHeight + verticalSpacing));
        
        nodes.forEach(node => {
          try {
            // Use level colors
            const levelColor = levelColors[level] || levelColors.default;
            
            const hexColor = levelColor.substring(1); // Remove #
            const r = parseInt(hexColor.substring(0, 2), 16);
            const g = parseInt(hexColor.substring(2, 4), 16);
            const b = parseInt(hexColor.substring(4, 6), 16);
            
            // Draw node box
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.2);
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(currentX, levelY, boxWidth, boxHeight, 1, 1, 'FD');
            
            // Draw the colored top border
            pdf.setFillColor(r, g, b);
            pdf.rect(currentX, levelY, boxWidth, 3, 'F');
            
            const textX = currentX + (boxWidth / 2);
            
            // Add name with better formatting
            pdf.setFontSize(8);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont(undefined, 'bold');
            
            // Draw name and handle overflow with ellipsis if needed
            const nameText = node.name || 'Unnamed';
            pdf.text(nameText, textX, levelY + 8, { 
              align: 'center',
              maxWidth: boxWidth - 4
            });
            
            // Add title
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont(undefined, 'normal');
            
            // Draw title and handle overflow
            const titleText = node.title || '';
            pdf.text(titleText, textX, levelY + 14, { 
              align: 'center',
              maxWidth: boxWidth - 4
            });
            
            // Store node position for drawing connections
            nodePositions[node.id] = {
              x: currentX + (boxWidth / 2),
              y: levelY,
              height: boxHeight
            };
            
            // Move to next position
            currentX += boxWidth + horizontalSpacing;
          } catch (nodeError) {
            console.error(`Error drawing node ${node.name || 'unknown'}:`, nodeError);
          }
        });
      }
      
      console.log('Drawing connections between nodes');
      
      // Draw connections between nodes
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.3);
      
      chartData.forEach(node => {
        if (node.parentId && nodePositions[node.id] && nodePositions[node.parentId]) {
          const child = nodePositions[node.id];
          const parent = nodePositions[node.parentId];
          
          // Draw line from parent bottom to child top
          const startX = parent.x;
          const startY = parent.y + parent.height;
          const endX = child.x;
          const endY = child.y;
          
          // Draw vertical line down from parent
          pdf.line(startX, startY, startX, startY + (verticalSpacing / 3));
          
          // Draw horizontal line to align with child's x position
          pdf.line(startX, startY + (verticalSpacing / 3), endX, startY + (verticalSpacing / 3));
          
          // Draw vertical line to child
          pdf.line(endX, startY + (verticalSpacing / 3), endX, endY);
        }
      });
      
      console.log(`Saving PDF as "${filename}.pdf"`);
      
      // Save the PDF
      pdf.save(`${filename}.pdf`);
      resolve();
    } catch (err) {
      console.error('PDF export error:', err);
      reject(err);
    }
  });
}; 