// SVG interaction and rendering utilities
import { SVGPanZoomHandler } from './svg-pan-zoom.js';
import { TooltipManager } from './tooltip-manager.js';
import { DOT_PATTERNS, DOT_VALUE_EXTRACTORS } from './dot-regex-patterns.js';

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

            // Extract edge information from SVG
            const edgeInfo = this.extractEdgeInfoFromSVG(edge, edgeId);

            // Try to find edge definition using start-label-end triplet
            let edgeDefinition = null;

            if (edgeInfo.sourceNode && edgeInfo.targetNode) {
                // Strategy 1: Try to find by start-label-end triplet if label is available
                if (edgeInfo.label) {
                    const tripletKey = `${edgeInfo.sourceNode}-${edgeInfo.label}-${edgeInfo.targetNode}`;
                    edgeDefinition = this.visualizer.edgeDefinitions[tripletKey];
                }

                // Strategy 2: If no triplet match, try traditional formats as fallback
                if (!edgeDefinition) {
                    const possibleKeys = [
                        `${edgeInfo.sourceNode}->${edgeInfo.targetNode}`,
                        `${edgeInfo.sourceNode}${edgeInfo.connector || '->'}${edgeInfo.targetNode}`,
                        `${edgeInfo.sourceNode} ${edgeInfo.targetNode}`,
                        edgeId
                    ];

                    for (const key of possibleKeys) {
                        if (this.visualizer.edgeDefinitions[key]) {
                            edgeDefinition = this.visualizer.edgeDefinitions[key];
                            break;
                        }
                    }
                }
            }

            // Strategy 3: Direct match with edge ID as last resort
            if (!edgeDefinition && this.visualizer.edgeDefinitions[edgeId]) {
                edgeDefinition = this.visualizer.edgeDefinitions[edgeId];
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

    // Extract edge information from SVG element and its attributes
    extractEdgeInfoFromSVG(edgeElement, edgeId) {
        let sourceNode = '';
        let targetNode = '';
        let label = '';
        let connector = '->';

        // Try to extract from edge ID (usually in format like "node1->node2")
        const edgeIdMatch = edgeId.match(/^(.+?)(->|--|-|→)(.+?)$/);
        if (edgeIdMatch) {
            sourceNode = edgeIdMatch[1].trim();
            connector = edgeIdMatch[2];
            targetNode = edgeIdMatch[3].trim();
        }

        // Try to extract label from SVG text elements within the edge
        const textElements = edgeElement.querySelectorAll('text');
        for (const textEl of textElements) {
            const textContent = textEl.textContent.trim();
            // Skip empty text or text that looks like coordinates
            if (textContent && !textContent.match(/^[\d\.\-\s]+$/)) {
                // This is likely the edge label
                label = textContent;
                break;
            }
        }

        // Alternative: Try to extract from the edge's path data or other attributes
        // This might be needed depending on how Graphviz renders the edges
        if (!label) {
            // Look for common Graphviz edge label attributes
            const labelAttr = edgeElement.getAttribute('data-label') ||
                edgeElement.getAttribute('label');
            if (labelAttr) {
                label = labelAttr;
            }
        }

        return {
            sourceNode,
            targetNode,
            label,
            connector,
            edgeId
        };
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

        const lines = dotContent.split(DOT_PATTERNS.UTILITY.LINE_BREAK);
        const nodeRegex = DOT_PATTERNS.NODE_ID.DEFINITION;
        const edgeRegex = DOT_PATTERNS.EDGE.DEFINITION;
        const keywords = ['graph', 'digraph', 'subgraph', 'node', 'edge'];

        let i = 0;
        while (i < lines.length) {
            const line = lines[i].trim();

            // Check for edge definition first (more specific pattern)
            const edgeMatch = line.match(edgeRegex);
            if (edgeMatch) {
                const { sourceNode, connector, targetNode } = DOT_VALUE_EXTRACTORS.extractEdgeNodes(edgeMatch);

                // Start collecting the edge definition
                let edgeDefinition = lines[i].trim();
                let bracketCount = (edgeDefinition.match(DOT_PATTERNS.UTILITY.OPEN_BRACKET) || []).length -
                    (edgeDefinition.match(DOT_PATTERNS.UTILITY.CLOSE_BRACKET) || []).length;

                // If the definition doesn't end on the same line, continue collecting
                while (bracketCount > 0 && i + 1 < lines.length) {
                    i++;
                    const nextLine = lines[i].trim();
                    edgeDefinition += '\n' + nextLine;
                    bracketCount += (nextLine.match(DOT_PATTERNS.UTILITY.OPEN_BRACKET) || []).length -
                        (nextLine.match(DOT_PATTERNS.UTILITY.CLOSE_BRACKET) || []).length;
                }

                // Remove trailing semicolon if present
                edgeDefinition = edgeDefinition.replace(DOT_PATTERNS.UTILITY.TRAILING_SEMICOLON, '');

                // Extract label from the edge definition to create unique identifier
                const labelMatch = edgeDefinition.match(DOT_PATTERNS.ATTRIBUTE.LABEL);
                const label = labelMatch ? DOT_VALUE_EXTRACTORS.extractValue(labelMatch, 1) : '';

                // Create unique edge identifiers using start-label-end triplet
                const uniqueEdgeId = label ?
                    `${sourceNode}-${label}-${targetNode}` :
                    `${sourceNode}-${targetNode}-${Date.now()}`; // Fallback for edges without labels

                // Store with multiple key formats for better matching
                edgeDefs[uniqueEdgeId] = edgeDefinition;

                // Also store traditional formats as fallbacks, but prioritize the unique ones
                const basicEdgeId = `${sourceNode}${connector}${targetNode}`;
                if (!edgeDefs[basicEdgeId]) {
                    edgeDefs[basicEdgeId] = edgeDefinition;
                }
                if (!edgeDefs[`${sourceNode}->${targetNode}`]) {
                    edgeDefs[`${sourceNode}->${targetNode}`] = edgeDefinition;
                }
                if (!edgeDefs[`${sourceNode} ${targetNode}`]) {
                    edgeDefs[`${sourceNode} ${targetNode}`] = edgeDefinition;
                }

            } else {
                // Check for node definition
                const nodeMatch = line.match(nodeRegex);
                if (nodeMatch) {
                    const id = DOT_VALUE_EXTRACTORS.extractValue(nodeMatch, 1);

                    // Skip DOT keywords
                    if (keywords.includes(id.toLowerCase())) {
                        i++;
                        continue;
                    }

                    // Start collecting the node definition
                    let nodeDefinition = lines[i].trim();
                    let bracketCount = (nodeDefinition.match(DOT_PATTERNS.UTILITY.OPEN_BRACKET) || []).length -
                        (nodeDefinition.match(DOT_PATTERNS.UTILITY.CLOSE_BRACKET) || []).length;

                    // If the definition doesn't end on the same line, continue collecting
                    while (bracketCount > 0 && i + 1 < lines.length) {
                        i++;
                        const nextLine = lines[i].trim();
                        nodeDefinition += '\n' + nextLine;
                        bracketCount += (nextLine.match(DOT_PATTERNS.UTILITY.OPEN_BRACKET) || []).length -
                            (nextLine.match(DOT_PATTERNS.UTILITY.CLOSE_BRACKET) || []).length;
                    }

                    // Remove trailing semicolon if present
                    nodeDefinition = nodeDefinition.replace(DOT_PATTERNS.UTILITY.TRAILING_SEMICOLON, '');
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
