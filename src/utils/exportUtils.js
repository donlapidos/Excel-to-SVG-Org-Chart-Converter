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
      // Find the chart-content element first
      const chartContent = container.querySelector('.chart-content');
      if (!chartContent) {
        throw new Error('Chart content element not found');
      }
      
      // Find the SVG element within the chart content
      const svgEl = chartContent.querySelector('svg');
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
 */
export const exportToPng = (container, filename = 'org-chart') => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure the chart is visible and properly laid out
      const chartContent = container.querySelector('.chart-content');
      if (!chartContent) {
        throw new Error('Chart content element not found');
      }
      
      // Use html2canvas directly on the chart content element with optimized settings
      html2canvas(chartContent, {
        backgroundColor: 'white',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        logging: false
      }).then(canvas => {
        // Get PNG data
        const pngUrl = canvas.toDataURL('image/png');
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${filename}.png`;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        
        // Trigger download
        downloadLink.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(downloadLink);
          resolve();
        }, 100);
      }).catch(err => {
        console.error('PNG export error:', err);
        reject(err);
      });
    } catch (err) {
      console.error('PNG export setup error:', err);
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
      
      // Create a new PDF document with larger format for org charts
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a2' // Changed from a4 to a2 for much larger charts
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
      const margin = 15; // Reduced margin for better use of space
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2) - 15; // Account for title
      
      // Find the level with the most nodes
      const numNodesWidest = Math.max(...Object.values(nodesByLevel).map(level => level.length));
      
      // Get total nodes in the chart (including hidden/consolidated ones)
      const consolidatedNodeCount = Object.values(nodesByLevel).flat().filter(node => node.isConsolidated).length;
      
      // Adjust spacing based on node density - more nodes means reduced spacing factor
      const totalNodes = Object.values(nodesByLevel).flat().length;
      
      // Calculate chart dimensions
      const levelCount = maxLevel + 1;
      
      // Optimal box height calculation - smaller when there are many levels
      const boxHeight = Math.max(20, Math.min(30, 40 - (levelCount * 0.8)));
      
      // Calculate spacing adjustment factor - fewer levels means more compact
      const spacingAdjustment = Math.max(0.5, Math.min(0.8, 
        0.9 - (0.05 * Math.log(totalNodes + 1)) - (consolidatedNodeCount > 0 ? 0.1 * Math.log(consolidatedNodeCount + 1) : 0)
      ));
      
      // Calculate vertical spacing - more compact with fewer levels
      const verticalSpacing = Math.min(25, 
        Math.max(10, (availableHeight - (boxHeight * levelCount)) / Math.max(1, levelCount + 1) * spacingAdjustment)
      );
      
      // Calculate box width based on the level with the most nodes
      const boxWidth = Math.min(100, Math.max(60, availableWidth / (numNodesWidest + 0.5)));
      
      // Calculate horizontal spacing
      const horizontalSpacing = Math.min(15, (availableWidth - (boxWidth * numNodesWidest)) / Math.max(1, numNodesWidest));

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
            // Get level color for this node
            const levelColor = levelColors[level] || levelColors.default;
            
            const hexColor = levelColor.substring(1); // Remove #
            const r = parseInt(hexColor.substring(0, 2), 16);
            const g = parseInt(hexColor.substring(2, 4), 16);
            const b = parseInt(hexColor.substring(4, 6), 16);
            
            // Calculate box dimensions - for consolidated nodes, make them larger
            let nodeBoxHeight = boxHeight;
            const hasDirectReports = node._directReports && node._directReports.length > 0;
            
            if (hasDirectReports) {
              // Increase height based on number of direct reports (more compact)
              nodeBoxHeight = Math.min(
                boxHeight * 2, // Don't let it get too large
                boxHeight + (node._directReports.length * 6) // Reduced height per report (was 10)
              );
            }
            
            // Draw node box
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.2);
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(currentX, levelY, boxWidth, nodeBoxHeight, 1, 1, 'FD');
            
            // Draw the colored top border
            pdf.setFillColor(r, g, b);
            pdf.rect(currentX, levelY, boxWidth, 3, 'F');
            
            const textX = currentX + (boxWidth / 2);
            
            if (hasDirectReports) {
              // For consolidated nodes, draw each direct report
              // Skip the "X Direct Reports" header and start directly with the reports
              // Just render a thin divider line at the top
              pdf.setDrawColor(230, 230, 230);
              pdf.setLineWidth(0.1);
              
              // Show only the "Reporting to" subheader
              if (node.title) {
                pdf.setFontSize(6.5);
                pdf.setTextColor(100, 100, 100);
                pdf.setFont(undefined, 'italic');
                pdf.text(node.title, textX, levelY + 8, { 
                  align: 'center',
                  maxWidth: boxWidth - 4
                });
              }
              
              // Then draw each direct report with a separator - more compact layout
              let yOffset = levelY + (node.title ? 15 : 10); // Start position adjusted based on title
              node._directReports.forEach((report, index) => {
                // Draw separator line except for first item
                if (index > 0) {
                  pdf.setDrawColor(230, 230, 230);
                  pdf.setLineWidth(0.1);
                  pdf.line(
                    currentX + 5, 
                    yOffset - 2, // Reduced spacing
                    currentX + boxWidth - 5, 
                    yOffset - 2
                  );
                }
                
                // Draw name with better formatting
                pdf.setFontSize(7);
                pdf.setTextColor(0, 0, 0);
                pdf.setFont(undefined, 'bold');
                pdf.text(report.name || 'Unnamed', textX, yOffset, { 
                  align: 'center',
                  maxWidth: boxWidth - 8
                });
                
                // Add title with more compact spacing
                pdf.setFontSize(6);
                pdf.setTextColor(100, 100, 100);
                pdf.setFont(undefined, 'normal');
                
                if (report.title) {
                  pdf.text(report.title, textX, yOffset + 4, { // Reduced spacing (was 5)
                    align: 'center',
                    maxWidth: boxWidth - 8
                  });
                  yOffset += 7; // Reduced spacing (was 10)
                } else {
                  yOffset += 5; // Reduced spacing (was 7)
                }
              });
            } else {
              // Standard node - draw name and title
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
            }
            
            // Store node position for drawing connections
            nodePositions[node.id] = {
              x: currentX + (boxWidth / 2),
              y: levelY,
              height: nodeBoxHeight
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
          
          // Use an even shorter first vertical segment (1/8 instead of 1/5)
          const connectorY = startY + (verticalSpacing / 8);
          
          // Draw vertical line down from parent (shorter)
          pdf.line(startX, startY, startX, connectorY);
          
          // Draw horizontal line to align with child's x position
          pdf.line(startX, connectorY, endX, connectorY);
          
          // Draw vertical line to child
          pdf.line(endX, connectorY, endX, endY);
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