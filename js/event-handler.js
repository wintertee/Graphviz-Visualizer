// Event handling utilities
export class EventHandler {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.renderTimeout = null;
        this.resizeTimeout = null;

        // Performance optimization: bind methods once
        this.boundMethods = {
            onLayoutChange: this.onLayoutChange.bind(this),
            onEditorInput: this.onEditorInput.bind(this),
            onWindowResize: this.onWindowResize.bind(this)
        };
    }

    setupAllEventListeners() {
        this.setupControlButtons();
        this.setupEditor();
        this.setupSampleButtons();
        this.setupWindowResize();
    }

    setupControlButtons() {
        const controls = {
            downloadBtn: () => this.visualizer.downloadSVG(),
            clearBtn: () => this.handleClearAction(),
            fitBtn: () => this.visualizer.fitToScreen(),
            zoomInBtn: () => this.visualizer.zoomIn(),
            zoomOutBtn: () => this.visualizer.zoomOut(),
            collapseBtn: () => this.toggleLeftPanel()
        };

        Object.entries(controls).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        });

        // Layout selector with improved error handling
        const layoutSelect = document.getElementById('layoutSelect');
        if (layoutSelect) {
            layoutSelect.addEventListener('change', this.boundMethods.onLayoutChange);
        }
    }

    onLayoutChange(e) {
        const newLayout = e.target.value;
        if (this.visualizer.currentLayout !== newLayout) {
            this.visualizer.currentLayout = newLayout;
            if (this.visualizer.currentDot) {
                this.visualizer.renderGraph();
            }
        }
    }

    handleClearAction() {
        if (this.visualizer.currentDot && this.visualizer.currentDot.trim()) {
            if (confirm('Are you sure you want to clear the current graph?')) {
                this.visualizer.clearAll();
            }
        } else {
            this.visualizer.clearAll();
        }
    }

    setupEditor() {
        const dotEditor = document.getElementById('dotEditor');
        if (!dotEditor) {
            console.error('DOT editor element not found');
            return;
        }

        // Use debounced input handler for better performance
        dotEditor.addEventListener('input', this.boundMethods.onEditorInput);

        // Add keyboard shortcuts
        dotEditor.addEventListener('keydown', this.handleEditorKeydown.bind(this));
    }

    onEditorInput() {
        // Clear existing timeout
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }

        // Debounce rendering to improve performance
        this.renderTimeout = setTimeout(() => {
            const dotEditor = document.getElementById('dotEditor');
            const content = dotEditor.value.trim();

            if (content && content !== this.visualizer.currentDot) {
                this.visualizer.currentDot = content;

                // Update edge filter when content changes
                this.visualizer.edgeFilter.parseEdgeLabels(content);
                this.visualizer.edgeFilter.updateFilterDropdown();

                this.visualizer.renderGraph();
            }
        }, 500); // 500ms debounce
    }

    handleEditorKeydown(e) {
        // Ctrl/Cmd + Enter to force render
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(this.renderTimeout);
            this.onEditorInput();
        }

        // Ctrl/Cmd + S to download SVG
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.visualizer.downloadSVG();
        }
    }

    setupSampleButtons() {
        document.querySelectorAll('.sample-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sampleType = e.target.dataset.sample;
                this.visualizer.loadSample(sampleType);
            });
        });
    }

    setupWindowResize() {
        window.addEventListener('resize', this.boundMethods.onWindowResize);
    }

    onWindowResize() {
        // Debounce resize events for better performance
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            const svg = document.querySelector('#graphContainer svg');
            if (svg && this.visualizer.svgState.resetTransform) {
                this.visualizer.svgState.resetTransform();
            }
        }, 100);
    }

    toggleLeftPanel() {
        const workspace = document.getElementById('workspace');
        const collapseBtn = document.getElementById('collapseBtn');
        const collapseBtnSpan = collapseBtn.querySelector('span');

        workspace.classList.toggle('collapsed');

        // 更新按钮箭头方向
        if (workspace.classList.contains('collapsed')) {
            collapseBtnSpan.textContent = '➡';
        } else {
            collapseBtnSpan.textContent = '⬅';
        }

        // 延迟触发resize以确保布局已完成
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    }
}
