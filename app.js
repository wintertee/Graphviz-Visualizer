// Main GraphvizVisualizer class with modular structure
import { instance } from "@viz-js/viz";
import { FileHandler } from './js/file-handler.js';
import { EventHandler } from './js/event-handler.js';
import { SVGRenderer } from './js/svg-renderer.js';
import { NotificationManager } from './js/notification-manager.js';
import { EdgeFilter } from './js/edge-filter.js';
import { CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES, UTILS } from './js/config.js';
import { ErrorHandler } from './js/error-handler.js';

class GraphvizVisualizer {
    constructor() {
        // Core state
        this.viz = null;
        this.currentDot = '';
        this.currentLayout = CONFIG.DEFAULT_LAYOUT;
        this.isInitializing = true;
        this.nodeDefinitions = {};
        this.edgeDefinitions = {};
        this.samples = {};

        // SVG interaction state
        this.svgState = {
            viewBox: null,
            initialViewBox: null,
            resetTransform: null,
            applyZoom: null
        };

        // Initialize module handlers with error handling
        this.initializeModules();

        // Setup error handling
        this.errorHandler = new ErrorHandler(this.notificationManager);

        this.showMessage('Loading Graphviz engine...', 'info');
        this.init().catch(this.handleInitError.bind(this));
    }

    initializeModules() {
        try {
            this.notificationManager = new NotificationManager();
            this.fileHandler = new FileHandler(this);
            this.eventHandler = new EventHandler(this);
            this.svgRenderer = new SVGRenderer(this);
            this.edgeFilter = new EdgeFilter(this);
        } catch (error) {
            console.error('Failed to initialize modules:', error);
            // Can't show notification yet since notificationManager might not be initialized
            alert('Failed to initialize application modules. Please refresh the page.');
        }
    }

    async handleInitError(error) {
        console.error('Application initialization failed:', error);
        this.showMessage('Failed to initialize application. Please refresh the page.', 'error');
        this.isInitializing = false;
    }

    async init() {
        await Promise.all([
            this.initializeViz(),
            this.initializeSamples()
        ]);
        this.setupEventListeners();
        this.showWorkspace(); // Always show workspace after initialization
    }

    async initializeViz() {
        try {
            console.log('Starting Viz.js 3.14.0 initialization...');
            this.viz = await instance();
            console.log('Viz.js 3.14.0 initialized successfully');
            this.isInitializing = false;
        } catch (error) {
            console.error('Failed to initialize Viz.js:', error);
            this.isInitializing = false;
            this.showMessage('Failed to initialize Graphviz engine. Please refresh the page.', 'error');
        }
    }

    async initializeSamples() {
        this.samples = await this.fileHandler.setupSamples();
    }

    setupEventListeners() {
        this.fileHandler.setupFileHandling();
        this.eventHandler.setupAllEventListeners();
        this.edgeFilter.setupEventListeners();
    }

    loadSample(sampleType) {
        if (this.samples[sampleType]) {
            this.loadDotContent(this.samples[sampleType]);
        }
    }

    loadDotContent(content) {
        this.currentDot = content;
        document.getElementById('dotEditor').value = content;

        // Parse edge labels and update filter dropdown
        this.edgeFilter.parseEdgeLabels(content);
        this.edgeFilter.updateFilterDropdown();

        this.showWorkspace();
        this.renderGraph();
    }

    showWorkspace() {
        const workspace = document.getElementById('workspace');
        workspace.style.display = 'flex';
        workspace.scrollIntoView({ behavior: 'smooth' });

        // Force layout recalculation
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    }

    async renderGraph() {
        // Validation checks
        if (this.isInitializing) {
            this.showMessage('Graphviz engine is still loading. Please wait a moment...', 'warning');
            return;
        }

        if (!this.viz) {
            this.showMessage('Graphviz engine failed to initialize. Please refresh the page.', 'error');
            return;
        }

        const dotContent = document.getElementById('dotEditor').value.trim();
        if (!dotContent) {
            this.showMessage('Please enter DOT content', 'warning');
            return;
        }

        // Validate layout engine
        if (!CONFIG.SUPPORTED_LAYOUTS.includes(this.currentLayout)) {
            this.currentLayout = CONFIG.DEFAULT_LAYOUT;
            this.showMessage(`Invalid layout engine, using ${this.currentLayout}`, 'warning');
        }

        this.currentDot = dotContent;

        // Parse both node and edge definitions
        const definitions = this.svgRenderer.parseDefinitions(dotContent);
        this.nodeDefinitions = definitions.nodes;
        this.edgeDefinitions = definitions.edges;

        // Parse edge labels and update filter dropdown
        this.edgeFilter.parseEdgeLabels(dotContent);
        this.edgeFilter.updateFilterDropdown();

        const container = document.getElementById('graphContainer');

        try {
            // Show loading state
            this.setLoadingState(container, 'Rendering graph...');

            // Render the graph using the new Viz.js API
            const svg = this.viz.renderSVGElement(dotContent, {
                engine: this.currentLayout
            });

            // Clear container and add the SVG
            container.innerHTML = '';
            container.appendChild(svg);

            // Make the SVG responsive and add interactions
            this.svgRenderer.setupSVGInteractions(svg, container);

            this.showMessage(SUCCESS_MESSAGES.GRAPH_RENDERED, 'info');

        } catch (error) {
            this.handleRenderError(error, container);
        }
    }

    async renderFilteredGraph(filteredDotContent) {
        // Validation checks
        if (this.isInitializing) {
            this.showMessage('Graphviz engine is still loading. Please wait a moment...', 'warning');
            return;
        }

        if (!this.viz) {
            this.showMessage('Graphviz engine failed to initialize. Please refresh the page.', 'error');
            return;
        }

        if (!filteredDotContent || !filteredDotContent.trim()) {
            this.showMessage('No edges match the selected filter criteria', 'warning');
            return;
        }

        const container = document.getElementById('graphContainer');

        try {
            // Show loading state
            this.setLoadingState(container, 'Applying filter and rendering graph...');

            // Render the filtered graph using the new Viz.js API
            const svg = this.viz.renderSVGElement(filteredDotContent, {
                engine: this.currentLayout
            });

            // Clear container and add the SVG
            container.innerHTML = '';
            container.appendChild(svg);

            // Make the SVG responsive and add interactions
            this.svgRenderer.setupSVGInteractions(svg, container);

        } catch (error) {
            this.handleRenderError(error, container, 'Filter Rendering Error');
        }
    }

    setLoadingState(container, message) {
        container.innerHTML = `<div class="loading">${message}</div>`;
    }

    handleRenderError(error, container, errorType = 'Rendering Error') {
        console.error(`${errorType}:`, error);

        const errorMessage = this.getErrorMessage(error);
        container.innerHTML = `<div class="error-message">
            <strong>${errorType}:</strong><br>
            ${errorMessage}
        </div>`;

        this.showMessage(`${errorType}: ${errorMessage}`, 'error');
    }

    getErrorMessage(error) {
        if (error.message) {
            return error.message;
        }

        if (typeof error === 'string') {
            return error;
        }

        return 'An unknown error occurred. Please check your DOT syntax.';
    }

    downloadSVG() {
        const svgElement = document.querySelector('#graphContainer svg');
        if (!svgElement) {
            this.showMessage('No graph to download. Please render a graph first.', 'error');
            return;
        }

        try {
            // Create a high-quality SVG copy
            const svgClone = this.prepareSVGForDownload(svgElement);
            const svgData = new XMLSerializer().serializeToString(svgClone);

            // Create blob and download
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = this.generateFilename();
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            this.showMessage(SUCCESS_MESSAGES.SVG_DOWNLOADED, 'info');

        } catch (error) {
            console.error('Download error:', error);
            this.showMessage(`Failed to download SVG: ${error.message}`, 'error');
        }
    }

    prepareSVGForDownload(svgElement) {
        const svgClone = svgElement.cloneNode(true);

        // Ensure proper XML namespace
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // Set explicit dimensions if they don't exist
        if (!svgClone.getAttribute('width') && !svgClone.getAttribute('height')) {
            const bbox = svgElement.getBBox();
            svgClone.setAttribute('width', bbox.width);
            svgClone.setAttribute('height', bbox.height);
        }

        return svgClone;
    }

    generateFilename() {
        return UTILS.generateFilename(this.currentLayout);
    }

    fitToScreen() {
        if (this.svgState.resetTransform) {
            this.svgState.resetTransform();
        } else {
            const svgElement = document.querySelector('#graphContainer svg');
            if (svgElement) {
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
            }
        }
    }

    zoomIn() {
        if (this.svgState.applyZoom) {
            this.svgState.applyZoom(1.2);
        }
    }

    zoomOut() {
        if (this.svgState.applyZoom) {
            this.svgState.applyZoom(0.8);
        }
    }

    clearAll() {
        this.currentDot = '';
        document.getElementById('dotEditor').value = '';
        document.getElementById('graphContainer').innerHTML = '';
        // Remove the line that hides workspace - keep it always visible

        // Reset edge filter
        this.edgeFilter.edgeLabels.clear();
        this.edgeFilter.selectedLabels.clear();
        this.edgeFilter.selectedLabels.add('all');
        this.edgeFilter.updateFilterDropdown();

        // Reset file input
        document.getElementById('fileInput').value = '';
    }

    showMessage(message, type = 'info') {
        this.notificationManager.showMessage(message, type);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GraphvizVisualizer();
});
