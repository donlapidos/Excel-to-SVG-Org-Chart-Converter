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
 * Color palette for departments
 */
export const departmentColors = {
  'Marketing': '#8bc34a',     // Light green
  'Sales': '#03a9f4',         // Light blue
  'Engineering': '#ff5722',   // Deep orange
  'Product': '#673ab7',       // Deep purple
  'HR': '#2196f3',            // Blue
  'Finance': '#009688',       // Teal
  'Operations': '#795548',    // Brown
  'IT': '#607d8b',            // Blue grey
  'Customer Support': '#ffc107', // Amber
  'Legal': '#9e9e9e',         // Grey
  default: '#78909c'          // Blue grey lighter
};

/**
 * Gets the color for a specific department
 * @param {String} departmentName - Name of the department
 * @returns {String} Color hex code
 */
export const getDepartmentColor = (departmentName) => {
  if (!departmentName) return departmentColors.default;
  
  // Check for exact match
  if (departmentColors[departmentName]) {
    return departmentColors[departmentName];
  }
  
  // Check for partial match
  const key = Object.keys(departmentColors).find(
    key => departmentName.includes(key) || key.includes(departmentName)
  );
  
  return key ? departmentColors[key] : departmentColors.default;
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
    .nodeWidth(d => {
      // Department nodes are wider
      if (d.data.isDepartment) {
        return nodeWidth * 1.2;
      }
      return nodeWidth;
    })
    .nodeHeight(d => {
      // If this is a department node
      if (d.data.isDepartment) {
        return nodeHeight * 0.8; // Department nodes are shorter
      }
      
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
    .linkUpdate(function(d) {
      // Use department colors for links between departments
      const stroke = d.source.data.isDepartment || d.target.data.isDepartment 
        ? "#999999" // Darker line for department connections
        : "#c7c7c7"; // Regular line for regular connections

      d3.select(this)
        .attr("stroke", stroke)
        .attr("stroke-width", d.source.data.isDepartment || d.target.data.isDepartment ? 2.5 : 2);
    });
};

/**
 * Creates the default node content HTML for the org chart
 * @param {Object} d - Node data
 * @returns {String} HTML content for the node
 */
export const defaultNodeContent = (d) => {
  // Defensive check for undefined data
  if (!d || !d.data) {
    return `
      <div style="
        height: 100%;
        width: 100%;
        border-radius: 8px;
        background-color: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        text-align: center;
      ">
        <div style="color: #999;">No data available</div>
      </div>
    `;
  }
  
  // Handle department nodes
  if (d.data.isDepartment) {
    const departmentName = d.data.name || 'Unknown Department';
    const departmentColor = getDepartmentColor(departmentName);
    
    return `
      <div style="
        height: 100%;
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
        border: 2px solid ${departmentColor};
        background-color: ${departmentColor}10; /* 10% opacity */
      ">
        <div style="
          background-color: ${departmentColor};
          padding: 8px 16px;
          text-align: center;
        ">
          <div style="
            color: white;
            font-size: 16px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${departmentName} Department</div>
        </div>
        <div style="
          padding: 10px 16px;
          flex: 1;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            font-size: 13px;
            color: #555;
            font-style: italic;
          ">Departmental Unit</div>
        </div>
      </div>
    `;
  }
  
  const directReports = d.data._directReports || [];
  
  // If this is a consolidated node with direct reports
  if (directReports.length > 0) {
    // Determine if we need to show department information
    const department = (d.data.department || '').trim();
    const departmentColor = department ? getDepartmentColor(department) : levelColors[2];
    
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
        border-top: 4px solid ${departmentColor};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        padding: 16px 12px;
        box-sizing: border-box;
        overflow: hidden;
        ${department ? `border-left: 2px solid ${departmentColor}; border-right: 2px solid ${departmentColor};` : ''}
      ">`;
    
    // Only show the title section if title is present
    if (d.data.title) {
      content += `
        <div style="
          width: 100%;
          margin-bottom: 10px;
          text-align: center;
        ">
          <div style="
            font-size: 12px;
            color: #777;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${d.data.title}</div>
        </div>`;
    }
    
    directReports.forEach((report, index) => {
      const reportName = report.name || 'Unnamed';
      const reportTitle = report.title || '';
      
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
          ">${reportName}</div>
          <div style="
            font-size: 12px;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
          ">${reportTitle}</div>
        </div>
      `;
    });
    
    content += `</div>`;
    return content;
  }

  // Determine if this node is a manager with department information
  const name = d.data.name || 'Unnamed';
  const title = d.data.title || '';
  const hasDepartment = d.data.department && d.data.department.trim() !== '';
  const departmentColor = hasDepartment ? getDepartmentColor(d.data.department) : null;
  const nodeDepth = typeof d.depth === 'number' ? d.depth : 0;
  
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
      ${hasDepartment ? `border-left: 3px solid ${departmentColor}; border-right: 3px solid ${departmentColor};` : ''}
    ">
      <div style="
        background-color: ${levelColors[nodeDepth] || levelColors.default};
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
        ">${name}</div>
      </div>
      <div style="
        padding: 12px 16px;
        flex: 1;
        text-align: center;
        background-color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          font-size: 14px;
          color: #555;
          font-weight: 400;
          ${hasDepartment ? 'margin-bottom: 6px;' : ''}
        ">${title}</div>
        
        ${hasDepartment ? `
          <div style="
            font-size: 12px;
            color: #666;
            padding: 2px 8px;
            background-color: ${departmentColor}15;
            border-radius: 4px;
            margin-top: 4px;
          ">${d.data.department}</div>
        ` : ''}
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
  
  // Check for circular references
  const visited = new Set();
  const nodesInProgress = new Set();
  
  const hasCircularReference = (nodeId) => {
    if (visited.has(nodeId)) return false;
    if (nodesInProgress.has(nodeId)) return true;
    
    nodesInProgress.add(nodeId);
    
    const node = data.find(n => n.id === nodeId);
    if (!node) {
      nodesInProgress.delete(nodeId);
      return false;
    }
    
    // Check children (including department nodes)
    const childNodes = data.filter(n => n.parentId === nodeId);
    for (const child of childNodes) {
      if (hasCircularReference(child.id)) {
        return true;
      }
    }
    
    nodesInProgress.delete(nodeId);
    visited.add(nodeId);
    return false;
  };
  
  if (hasCircularReference(rootNode.id)) {
    return 'Circular reference detected in the reporting structure. Please check your data.';
  }
  
  // Validate department structures
  const departmentNodes = data.filter(node => node.isDepartment);
  if (departmentNodes.length > 0) {
    console.log(`Found ${departmentNodes.length} department nodes`);
    
    // Check if any department nodes have invalid references
    for (const dept of departmentNodes) {
      // Check if department head exists
      if (dept.departmentHead) {
        const headExists = data.some(node => node.id === dept.departmentHead);
        if (!headExists) {
          console.warn(`Department ${dept.name} references non-existent department head ID: ${dept.departmentHead}`);
        }
      }
      
      // Check if parent node exists
      if (dept.parentId) {
        const parentExists = data.some(node => node.id === dept.parentId);
        if (!parentExists) {
          console.warn(`Department ${dept.name} references non-existent parent ID: ${dept.parentId}`);
        }
      }
      
      // Check if all department members exist
      if (dept.departmentMembers && Array.isArray(dept.departmentMembers)) {
        const missingMembers = dept.departmentMembers.filter(
          memberId => !data.some(node => node.id === memberId)
        );
        
        if (missingMembers.length > 0) {
          console.warn(`Department ${dept.name} references ${missingMembers.length} non-existent member IDs`);
        }
      }
    }
  }
  
  return null;
};

// Function that renders a node based on the provided data
export function renderNode(nodeGroup, nodeData, nodeWidth, nodeHeight) {
  // Clear previous content
  nodeGroup.selectAll('*').remove();
  
  // Add the rectangle for the node
  nodeGroup.append('rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('fill', nodeData.isConsolidated ? '#f0f8ff' : '#e8f4f8')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1);

  // Add the name text
  const nameText = nodeGroup.append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', nodeHeight * 0.3)
    .attr('text-anchor', 'middle')
    .attr('class', 'name-text')
    .style('font-weight', 'bold')
    .style('font-size', '14px');

  // Render name differently for consolidated nodes
  if (nodeData.isConsolidated) {
    // For consolidated nodes, keep it simple
    nameText.text('Team Members');
  } else {
    // For regular nodes, display the name
    nameText.text(nodeData.name);
  }

  // Add the title text
  nodeGroup.append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', nodeHeight * 0.6)
    .attr('text-anchor', 'middle')
    .attr('class', 'title-text')
    .style('font-size', '12px')
    .text(nodeData.title);
}

// Function to render links between nodes
export function renderLinks(svg, links, nodeWidth, nodeHeight) {
  // Create a path generator for the links
  svg.selectAll('.link').remove();

  svg.selectAll('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => {
      const sourceX = d.source.x + nodeWidth / 2;
      const sourceY = d.source.y + nodeHeight;
      const targetX = d.target.x + nodeWidth / 2;
      const targetY = d.target.y;

      // Create a path with a curve
      return `M${sourceX},${sourceY} C${sourceX},${sourceY + 40} ${targetX},${targetY - 40} ${targetX},${targetY}`;
    })
    .attr('fill', 'none')
    .attr('stroke', '#999')
    .attr('stroke-width', 1.5);
} 