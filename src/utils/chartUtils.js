import * as d3 from 'd3';
import { OrgChart } from 'd3-org-chart';

/**
 * Color palette for different levels in the org chart
 */
export const levelColors = {
  0: '#3f51b5',  // Root/top level (blue)
  1: '#4caf50',  // Second level (green)
  2: '#ff9800',  // Third level (orange)
  3: '#9c27b0',  // Fourth level (purple)
  4: '#e91e63',  // Fifth level (pink)
  5: '#2196f3',  // Sixth level (light blue)
  default: '#607d8b'  // Default for deeper levels (gray-blue)
};

/**
 * Creates and configures an org chart instance
 * @param {HTMLElement} container - DOM element to contain the chart
 * @param {Number} width - Chart width
 * @param {Number} height - Chart height
 * @returns {Object} Configured org chart instance
 */
export const createOrgChart = (container, width = 1600, height = 800) => {
  const nodeWidth = 220;
  const nodeHeight = 120;
  
  return new OrgChart()
    .container(container)
    .svgWidth(width)
    .svgHeight(height)
    .nodeWidth(() => nodeWidth)
    .nodeHeight(d => {
      // If this is a consolidated node with direct reports
      if (d.data._directReports && d.data._directReports.length > 0) {
        // Calculate height based on number of direct reports
        // Base height + additional height per direct report
        return Math.max(nodeHeight, 50 + d.data._directReports.length * 60);
      }
      return nodeHeight;
    })
    .childrenMargin(() => 60)
    .compactMarginBetween(() => 40)
    .compactMarginPair(() => 60) 
    .siblingsMargin(() => 40)
    .nodeId((d) => d.id)
    .parentNodeId((d) => d.parentId)
    .buttonContent(() => '')
    .compact(false)
    .layout('top')
    .linkUpdate(function() {
      d3.select(this)
        .attr("stroke", "#c7c7c7")
        .attr("stroke-width", 2);
    });
};

/**
 * Creates the default node content HTML for the org chart
 * @param {Object} d - Node data
 * @returns {String} HTML content for the node
 */
export const defaultNodeContent = (d) => {
  const directReports = d.data._directReports || [];
  
  // If this is a consolidated node with direct reports
  if (directReports.length > 0) {
    // Create a box with stacked direct reports
    let content = `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 8px;
        background-color: white;
        border-top: 4px solid ${levelColors[2]};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        padding: 16px 12px;
        box-sizing: border-box;
        overflow: hidden;
      ">`;
    
    directReports.forEach((report, index) => {
      content += `
        <div style="
          width: 100%;
          margin-top: ${index > 0 ? '18px' : '0'};
          padding-top: ${index > 0 ? '18px' : '0'};
          border-top: ${index > 0 ? '1px solid #f0f0f0' : 'none'};
        ">
          <div style="
            font-weight: 500;
            font-size: 14px;
            color: #333;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
          ">${report.name}</div>
          <div style="
            font-size: 12px;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
          ">${report.title || ''}</div>
        </div>
      `;
    });
    
    content += `</div>`;
    return content;
  }

  // Standard node (typically a manager)
  return `
    <div style="
      height: 100%;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e0e0e0;
    ">
      <div style="
        background-color: ${levelColors[d.depth] || levelColors.default};
        padding: 12px 16px;
        text-align: center;
      ">
        <div style="
          color: white;
          font-size: 16px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        ">${d.data.name}</div>
      </div>
      <div style="
        padding: 12px 16px;
        flex: 1;
        text-align: center;
        background-color: white;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          font-size: 14px;
          color: #555;
          font-weight: 400;
        ">${d.data.title || ''}</div>
      </div>
    </div>
  `;
};

/**
 * Clears all content from a container
 * @param {HTMLElement} container - Container to clear
 */
export const clearContainer = (container) => {
  if (container) {
    d3.select(container).selectAll('*').remove();
  }
};

/**
 * Validates the chart data and returns error message if invalid
 * @param {Array} data - Chart data
 * @returns {String|null} Error message or null if valid
 */
export const validateChartData = (data) => {
  if (!data || data.length === 0) {
    return "No data available to render chart";
  }

  // Find the root node (node with no parent)
  const rootNode = data.find(node => !node.parentId);
  if (!rootNode) {
    return 'No root node found in the data. Make sure there is one person who does not report to anyone.';
  }
  
  return null;
}; 