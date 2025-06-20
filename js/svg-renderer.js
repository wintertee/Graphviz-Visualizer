// SVG interaction and rendering utilities
import { SVGPanZoomHandler } from './svg-pan-zoom.js';
import { TooltipManager } from './tooltip-manager.js';

export class SVGRenderer {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.currentPanZoomHandler = null;
        this.tooltipManager = new TooltipManager();
    }

    setupSVGInteractions(svg, container) {
        if (!svg || !container) {
            console.error('Invalid SVG or container provided to setupSVGInteractions');
            return;
        }

        try {
            // Clean up existing tooltips
            this.cleanupTooltips(svg);

            this.prepareSVGForInteraction(svg);
            this.setupSVGViewBox(svg);
            this.setupSVGEventHandlers(svg);
            this.setupNodeTooltips(svg);
            this.setupEdgeTooltips(svg);
            this.exposeSVGControlFunctions();
        } catch (error) {
            console.error('Error setting up SVG interactions:', error);
            this.visualizer.showMessage('Warning: Some interactive features may not work properly', 'warning');
        }
    }

    cleanupTooltips(svg) {
        // Clean up existing custom tooltip handlers
        const elementsWithTooltips = svg.querySelectorAll('[data-has-tooltip], g.node, g.edge');
        elementsWithTooltips.forEach(element => {
            if (element._tooltipCleanup) {
                element._tooltipCleanup();
                delete element._tooltipCleanup;
            }
        });
    }

    prepareSVGForInteraction(svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.cursor = 'grab';
        svg.style.userSelect = 'none';
        svg.style.touchAction = 'none';
        svg.style.display = 'block';

        svg.removeAttribute('width');
        svg.removeAttribute('height');
    }

    setupSVGViewBox(svg) {
        let viewBox;

        try {
            if (svg.getAttribute('viewBox')) {
                viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);

                // Validate viewBox values
                if (viewBox.length !== 4 || viewBox.some(val => isNaN(val))) {
                    throw new Error('Invalid viewBox format');
                }
            } else {
                const bbox = svg.getBBox();
                const padding = Math.max(bbox.width, bbox.height) * 0.05; // 5% padding
                viewBox = [
                    bbox.x - padding,
                    bbox.y - padding,
                    bbox.width + 2 * padding,
                    bbox.height + 2 * padding
                ];
            }

            this.visualizer.svgState.viewBox = viewBox;
            this.visualizer.svgState.initialViewBox = [...viewBox];
            svg.setAttribute('viewBox', viewBox.join(' '));

        } catch (error) {
            console.error('Error setting up SVG viewBox:', error);
            // Fallback to default viewBox
            const defaultViewBox = [0, 0, 800, 600];
            this.visualizer.svgState.viewBox = defaultViewBox;
            this.visualizer.svgState.initialViewBox = [...defaultViewBox];
            svg.setAttribute('viewBox', defaultViewBox.join(' '));
        }
    }

    setupSVGEventHandlers(svg) {
        try {
            // Clean up previous event handlers
            if (this.currentPanZoomHandler) {
                this.currentPanZoomHandler.cleanup();
            }

            this.currentPanZoomHandler = new SVGPanZoomHandler(svg, this.visualizer.svgState);

            // Add event listeners with proper error handling
            svg.addEventListener('mousedown', this.currentPanZoomHandler.onPointerDown.bind(this.currentPanZoomHandler));
            svg.addEventListener('touchstart', this.currentPanZoomHandler.onPointerDown.bind(this.currentPanZoomHandler), { passive: false });
            svg.addEventListener('wheel', this.currentPanZoomHandler.onWheel.bind(this.currentPanZoomHandler), { passive: false });

        } catch (error) {
            console.error('Error setting up SVG event handlers:', error);
        }
    }

    setupNodeTooltips(svg) {
        const nodes = svg.querySelectorAll('g.node');
        nodes.forEach(node => {
            // Clean up existing tooltip handlers
            if (node._tooltipCleanup) {
                node._tooltipCleanup();
            }

            const titleElement = node.querySelector('title');
            if (!titleElement) return;

            const nodeId = titleElement.textContent.trim();
            let content = titleElement.textContent;

            if (this.visualizer.nodeDefinitions[nodeId]) {
                content = this.visualizer.nodeDefinitions[nodeId];
            }

            // Remove the SVG title element to prevent default browser tooltip
            titleElement.remove();

            // Setup custom tooltip
            this.tooltipManager.setupElementTooltips(node, content, 'node');
        });
    }

    setupEdgeTooltips(svg) {
        const edges = svg.querySelectorAll('g.edge');
        edges.forEach(edge => {
            // Clean up existing tooltip handlers
            if (edge._tooltipCleanup) {
                edge._tooltipCleanup();
            }

            const titleElement = edge.querySelector('title');
            if (!titleElement) return;

            const edgeId = titleElement.textContent.trim();
            let content = titleElement.textContent;

            // Try to find edge definition using multiple strategies
            let edgeDefinition = null;

            // Strategy 1: Direct match
            if (this.visualizer.edgeDefinitions[edgeId]) {
                edgeDefinition = this.visualizer.edgeDefinitions[edgeId];
            } else {
                // Strategy 2: Try to find by pattern matching
                for (const [key, value] of Object.entries(this.visualizer.edgeDefinitions)) {
                    // Check if the edge ID contains the pattern from the key
                    if (edgeId.includes(key.replace('->', '->')) ||
                        key.includes(edgeId) ||
                        this.edgeIdMatches(edgeId, key)) {
                        edgeDefinition = value;
                        break;
                    }
                }
            }

            if (edgeDefinition) {
                content = edgeDefinition;
            }

            // Remove the SVG title element to prevent default browser tooltip
            titleElement.remove();

            // Setup custom tooltip
            this.tooltipManager.setupElementTooltips(edge, content, 'edge');
        });
    }

    // Helper method to match edge IDs with more flexibility
    edgeIdMatches(actualEdgeId, definitionKey) {
        // Handle cases where edge IDs might have different formats
        // e.g., "nodeA->nodeB" vs "nodeA -> nodeB" vs "nodeA nodeB"
        const normalizedActual = actualEdgeId.replace(/\s+/g, '').replace(/->|--/g, '->');
        const normalizedKey = definitionKey.replace(/\s+/g, '').replace(/->|--/g, '->');
        return normalizedActual === normalizedKey;
    }

    formatNodeDefinitionForTooltip(definition) {
        // If the definition is multi-line, keep the formatting but make it more readable
        if (definition.includes('\n')) {
            return definition
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');
        }

        // For single-line definitions, try to format them nicely
        return definition.replace(/,\s*/g, ',\n    ').replace(/\[/, '[\n    ').replace(/\]/, '\n]');
    }

    exposeSVGControlFunctions() {
        this.visualizer.svgState.resetTransform = () => {
            this.visualizer.svgState.viewBox = [...this.visualizer.svgState.initialViewBox];
            this.updateViewBox();
        };

        this.visualizer.svgState.applyZoom = (zoomFactor) => {
            const svg = document.querySelector('#graphContainer svg');
            if (!svg) return;

            const rect = svg.getBoundingClientRect();
            const center = { x: rect.width / 2, y: rect.height / 2 };

            const panZoomHandler = new SVGPanZoomHandler(svg, this.visualizer.svgState);
            panZoomHandler.handleZoom(1 / zoomFactor, center);
        };
    }

    updateViewBox() {
        const svg = document.querySelector('#graphContainer svg');
        if (svg && this.visualizer.svgState.viewBox) {
            svg.setAttribute('viewBox', this.visualizer.svgState.viewBox.join(' '));
        }
    }

    parseDefinitions(dotContent) {
        const nodeDefs = {};
        const edgeDefs = {};
        if (!dotContent) return { nodes: nodeDefs, edges: edgeDefs };

        const lines = dotContent.split(/\r?\n/);
        const nodeRegex = /^\s*([a-zA-Z0-9_]+)\s*\[/;
        // Updated edge regex to handle complex node IDs (including numbers and underscores)
        const edgeRegex = /^\s*([a-zA-Z0-9_]+)\s*(-[->]|--)\s*([a-zA-Z0-9_]+)\s*\[/;
        const keywords = ['graph', 'digraph', 'subgraph', 'node', 'edge'];

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            // Check for edge definition first (more specific pattern)
            const edgeMatch = line.match(edgeRegex);
            if (edgeMatch) {
                const sourceNode = edgeMatch[1];
                const connector = edgeMatch[2];
                const targetNode = edgeMatch[3];
                const edgeId = `${sourceNode}${connector}${targetNode}`;

                // Start collecting the edge definition
                let edgeDefinition = lines[i].trim();
                let bracketCount = (edgeDefinition.match(/\[/g) || []).length - (edgeDefinition.match(/\]/g) || []).length;

                // If the definition doesn't end on the same line, continue collecting
                while (bracketCount > 0 && i + 1 < lines.length) {
                    i++;
                    const nextLine = lines[i].trim();
                    edgeDefinition += '\n' + nextLine;
                    bracketCount += (nextLine.match(/\[/g) || []).length - (nextLine.match(/\]/g) || []).length;
                }

                // Remove trailing semicolon if present
                edgeDefinition = edgeDefinition.replace(/;$/, '');

                // Store with multiple key formats for better matching
                edgeDefs[edgeId] = edgeDefinition;
                edgeDefs[`${sourceNode}->${targetNode}`] = edgeDefinition;
                edgeDefs[`${sourceNode} ${targetNode}`] = edgeDefinition;

            } else {
                // Check for node definition
                const nodeMatch = line.match(nodeRegex);
                if (nodeMatch) {
                    const id = nodeMatch[1];

                    // Skip DOT keywords
                    if (keywords.includes(id.toLowerCase())) {
                        i++;
                        continue;
                    }

                    // Start collecting the node definition
                    let nodeDefinition = lines[i].trim();
                    let bracketCount = (nodeDefinition.match(/\[/g) || []).length - (nodeDefinition.match(/\]/g) || []).length;

                    // If the definition doesn't end on the same line, continue collecting
                    while (bracketCount > 0 && i + 1 < lines.length) {
                        i++;
                        const nextLine = lines[i].trim();
                        nodeDefinition += '\n' + nextLine;
                        bracketCount += (nextLine.match(/\[/g) || []).length - (nextLine.match(/\]/g) || []).length;
                    }

                    // Remove trailing semicolon if present
                    nodeDefinition = nodeDefinition.replace(/;$/, '');
                    nodeDefs[id] = nodeDefinition;
                }
            }

            i++;
        }

        return { nodes: nodeDefs, edges: edgeDefs };
    }

    // Legacy method for backward compatibility
    parseNodeDefinitions(dotContent) {
        const result = this.parseDefinitions(dotContent);
        return result.nodes;
    }
}
