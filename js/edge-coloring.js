// Edge coloring module for coloring edges by type
import { DOT_PATTERNS, DOT_VALUE_EXTRACTORS } from './dot-regex-patterns.js';

export class EdgeColoring {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.isEnabled = false;
        this.edgeTypes = new Set();
        this.colorMap = new Map();
        
        // Predefined color palette - sufficient for most use cases
        this.colorPalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
            '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
            '#FF6348', '#2ED573', '#3742FA', '#A55EEA', '#26D0CE',
            '#FFA502', '#FF3838', '#1DD1A1', '#5352ED', '#FC427B',
            '#2F3542', '#40407A', '#706FD3', '#F8B500', '#B33771',
            '#3D5A80', '#EE6C4D', '#3A86FF', '#06FFA5', '#FFBE0B',
            '#FB8500', '#8ECAE6', '#219EBC', '#023047', '#FFB3C6',
            '#FB8B24', '#D62828', '#F77F00', '#FCBF49', '#003566'
        ];
    }

    // Parse edge types from DOT content (reuse edge filter's logic)
    parseEdgeTypes(dotContent) {
        this.edgeTypes.clear();
        
        try {
            const lines = dotContent.split('\n');
            let i = 0;

            while (i < lines.length) {
                const line = lines[i];
                const trimmedLine = line.trim();

                // Check if this line starts an edge definition
                if (trimmedLine.includes('->') || trimmedLine.includes('--')) {
                    // Parse the complete edge definition
                    const edgeBlock = this.parseCompleteEdge(lines, i);

                    if (edgeBlock.edgeText) {
                        // Check if the complete edge has a label
                        const labelMatch = edgeBlock.edgeText.match(DOT_PATTERNS.ATTRIBUTE.LABEL);
                        if (labelMatch) {
                            const labelValue = DOT_VALUE_EXTRACTORS.extractValue(labelMatch, 1);
                            this.edgeTypes.add(labelValue);
                        } else {
                            // Add edges without labels as a special type
                            this.edgeTypes.add('__no_label__');
                        }
                    }

                    // Skip to after this edge block
                    i = edgeBlock.endLineIndex + 1;
                } else {
                    i++;
                }
            }

        } catch (error) {
            console.error('Error parsing edge types for coloring:', error);
        }

        return Array.from(this.edgeTypes).sort();
    }

    // Parse a complete edge definition that might span multiple lines (borrowed from edge-filter.js)
    parseCompleteEdge(lines, startIndex) {
        let edgeText = '';
        let currentIndex = startIndex;
        let bracketDepth = 0;
        let foundOpenBracket = false;

        // Continue parsing until we have a complete edge definition
        while (currentIndex < lines.length) {
            const line = lines[currentIndex];
            const trimmedLine = line.trim();

            edgeText += line;
            if (currentIndex < lines.length - 1) {
                edgeText += '\n';
            }

            // Count brackets to determine when edge definition ends
            for (let char of line) {
                if (char === '[') {
                    bracketDepth++;
                    foundOpenBracket = true;
                } else if (char === ']') {
                    bracketDepth--;
                }
            }

            // If we found brackets and they're balanced, or if no brackets at all
            if ((foundOpenBracket && bracketDepth === 0) ||
                (!foundOpenBracket && (trimmedLine.endsWith(';') || !trimmedLine.includes('=')))) {
                break;
            }

            currentIndex++;
        }

        return {
            edgeText: edgeText,
            endLineIndex: currentIndex
        };
    }

    // Generate color mapping for edge types
    generateColorMapping() {
        this.colorMap.clear();
        const types = Array.from(this.edgeTypes).sort();
        
        types.forEach((type, index) => {
            // Use modulo to cycle through colors if we have more types than colors
            const colorIndex = index % this.colorPalette.length;
            this.colorMap.set(type, this.colorPalette[colorIndex]);
        });

        return this.colorMap;
    }

    // Apply coloring to DOT content
    applyColoring(dotContent) {
        if (!this.isEnabled || this.edgeTypes.size === 0) {
            return dotContent;
        }

        // Generate color mapping
        this.generateColorMapping();

        try {
            const lines = dotContent.split('\n');
            let result = [];
            let i = 0;

            while (i < lines.length) {
                const line = lines[i];
                const trimmedLine = line.trim();

                // Check if this line starts an edge definition
                if (trimmedLine.includes('->') || trimmedLine.includes('--')) {
                    // Parse the complete edge definition
                    const edgeBlock = this.parseCompleteEdge(lines, i);

                    if (edgeBlock.edgeText) {
                        // Process the edge with coloring
                        const coloredEdge = this.addColorToEdge(edgeBlock.edgeText);
                        result.push(coloredEdge);
                    } else {
                        result.push(line);
                    }

                    // Skip to after this edge block
                    i = edgeBlock.endLineIndex + 1;
                } else {
                    result.push(line);
                    i++;
                }
            }

            return result.join('\n');

        } catch (error) {
            console.error('Error applying edge coloring:', error);
            return dotContent; // Return original content on error
        }
    }

    // Add color attribute to a single edge
    addColorToEdge(edgeText) {
        try {
            // Determine edge type
            let edgeType = '__no_label__';
            const labelMatch = edgeText.match(DOT_PATTERNS.ATTRIBUTE.LABEL);
            if (labelMatch) {
                edgeType = DOT_VALUE_EXTRACTORS.extractValue(labelMatch, 1);
            }

            // Get color for this edge type
            const color = this.colorMap.get(edgeType);
            if (!color) {
                return edgeText; // Return unchanged if no color found
            }

            // Check if edge already has attributes
            const hasAttributes = edgeText.includes('[') && edgeText.includes(']');
            
            if (hasAttributes) {
                // Check if color attribute already exists
                const colorPattern = /\bcolor\s*=\s*[^,\]]+/i;
                if (colorPattern.test(edgeText)) {
                    // Replace existing color
                    return edgeText.replace(colorPattern, `color="${color}"`);
                } else {
                    // Add color to existing attributes
                    return edgeText.replace(/\]/, `, color="${color}"]`);
                }
            } else {
                // Add new attribute block with color
                const edgePattern = /(.*?)(->|--)(.*?)(;|\s*$)/;
                const match = edgeText.match(edgePattern);
                if (match) {
                    const [, source, connector, target, ending] = match;
                    return `${source}${connector}${target} [color="${color}"]${ending}`;
                }
            }

            return edgeText;

        } catch (error) {
            console.error('Error adding color to edge:', error);
            return edgeText;
        }
    }

    // Toggle edge coloring on/off
    toggle() {
        this.isEnabled = !this.isEnabled;
        
        // Update UI to reflect the change
        this.updateToggleButton();
        
        // Apply changes immediately
        this.applyColoringToCurrentGraph();
        
        return this.isEnabled;
    }

    // Update the toggle button appearance
    updateToggleButton() {
        const button = document.getElementById('edgeColoringToggle');
        if (button) {
            if (this.isEnabled) {
                button.classList.add('active');
                button.textContent = '🎨 Edge Coloring: ON';
                button.title = 'Click to disable edge coloring';
            } else {
                button.classList.remove('active');
                button.textContent = '🎨 Edge Coloring: OFF';
                button.title = 'Click to enable edge coloring by type';
            }
        }
    }

    // Apply coloring to the current graph
    applyColoringToCurrentGraph() {
        // Get current DOT content from editor first
        const currentDot = document.getElementById('dotEditor').value.trim();
        
        if (!currentDot) {
            this.visualizer.showMessage('Please enter DOT content first', 'warning');
            return;
        }

        // Update the visualizer's currentDot if needed
        if (currentDot !== this.visualizer.currentDot) {
            this.visualizer.currentDot = currentDot;
        }

        try {
            if (this.isEnabled) {
                // Check if edge filter is active
                let contentToColor = currentDot;
                if (this.visualizer.edgeFilter.isFilterActive()) {
                    // Use filtered content if filter is active
                    contentToColor = this.visualizer.edgeFilter.getCurrentFilteredContent();
                }
                
                // Parse edge types and apply coloring to the content (filtered or original)
                this.parseEdgeTypes(contentToColor);
                const coloredDot = this.applyColoring(contentToColor);
                
                // Show color legend
                this.showColorLegend();
                
                // Re-render with colored edges
                this.visualizer.renderColoredGraph(coloredDot);
                
                this.visualizer.showMessage(
                    `Edge coloring applied to ${this.edgeTypes.size} edge types`, 
                    'success'
                );
            } else {
                // Hide color legend
                this.hideColorLegend();
                
                // Check if we need to apply filter or render normally
                if (this.visualizer.edgeFilter.isFilterActive()) {
                    const filteredDot = this.visualizer.edgeFilter.getCurrentFilteredContent();
                    this.visualizer.renderFilteredGraph(filteredDot);
                } else {
                    this.visualizer.renderGraph();
                }
                
                this.visualizer.showMessage('Edge coloring disabled', 'info');
            }

        } catch (error) {
            console.error('Error applying edge coloring:', error);
            this.visualizer.showMessage('Error applying edge coloring', 'error');
        }
    }

    // Show color legend
    showColorLegend() {
        if (this.edgeTypes.size === 0) {
            return;
        }

        // Remove existing legend
        this.hideColorLegend();

        // Create legend container
        const legend = document.createElement('div');
        legend.id = 'edgeColorLegend';
        legend.className = 'edge-color-legend';
        
        // Add legend title
        const title = document.createElement('div');
        title.className = 'legend-title';
        title.textContent = 'Edge Colors by Type';
        legend.appendChild(title);

        // Add color items
        const types = Array.from(this.edgeTypes).sort();
        types.forEach(type => {
            const color = this.colorMap.get(type);
            if (color) {
                const item = document.createElement('div');
                item.className = 'legend-item';
                
                const colorBox = document.createElement('div');
                colorBox.className = 'legend-color';
                colorBox.style.backgroundColor = color;
                
                const label = document.createElement('span');
                label.className = 'legend-label';
                label.textContent = type === '__no_label__' ? 'No label' : type;
                
                item.appendChild(colorBox);
                item.appendChild(label);
                legend.appendChild(item);
            }
        });

        // Append to visualization section
        const vizSection = document.querySelector('.visualization-section');
        if (vizSection) {
            vizSection.appendChild(legend);
        }
    }

    // Hide color legend
    hideColorLegend() {
        const legend = document.getElementById('edgeColorLegend');
        if (legend) {
            legend.remove();
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Initialize toggle button state
        this.updateToggleButton();
    }

    // Get current coloring status and statistics
    getStatus() {
        return {
            enabled: this.isEnabled,
            edgeTypeCount: this.edgeTypes.size,
            colorMap: new Map(this.colorMap),
            edgeTypes: Array.from(this.edgeTypes)
        };
    }
}
