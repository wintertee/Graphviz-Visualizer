// File handling utilities
import { DOT_PATTERNS } from './dot-regex-patterns.js';

export class FileHandler {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.supportedExtensions = ['.dot', '.gv'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
    }

    setupFileHandling() {
        this.setupFileInput();
        this.setupDragAndDrop();
        this.setupBrowseButton();
    }

    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    setupBrowseButton() {
        const browseBtn = document.getElementById('browseBtn');
        const fileInput = document.getElementById('fileInput');

        browseBtn.addEventListener('click', () => fileInput.click());
    }

    setupDragAndDrop() {
        const dotEditor = document.getElementById('dotEditor');
        const editorSection = dotEditor.closest('.editor-section');

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dotEditor.addEventListener(eventName, this.preventDefaults, false);
            editorSection.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dotEditor.addEventListener(eventName, () => this.highlight(editorSection), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dotEditor.addEventListener(eventName, () => this.unhighlight(editorSection), false);
        });

        // Handle dropped files
        dotEditor.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight(element) {
        element.classList.add('dragover');
    }

    unhighlight(element) {
        element.classList.remove('dragover');
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.loadFile(files[0]);
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.loadFile(file);
        }
    }

    loadFile(file) {
        // Validate file extension
        const fileName = file.name.toLowerCase();
        const isValidExtension = this.supportedExtensions.some(ext =>
            fileName.endsWith(ext)
        );

        if (!isValidExtension) {
            this.visualizer.showMessage(
                `Please select a file with one of these extensions: ${this.supportedExtensions.join(', ')}`,
                'error'
            );
            return;
        }

        // Validate file size
        if (file.size > this.maxFileSize) {
            this.visualizer.showMessage(
                `File is too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`,
                'error'
            );
            return;
        }

        // Validate file type
        if (file.size === 0) {
            this.visualizer.showMessage('Selected file is empty', 'error');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target.result;

                // Basic validation of DOT content
                if (!this.isValidDotContent(content)) {
                    this.visualizer.showMessage(
                        'The file does not appear to contain valid DOT syntax',
                        'warning'
                    );
                }

                this.visualizer.loadDotContent(content);
                this.visualizer.showMessage(`File "${file.name}" loaded successfully`, 'info');

            } catch (error) {
                console.error('Error processing file:', error);
                this.visualizer.showMessage('Error processing file content', 'error');
            }
        };

        reader.onerror = () => {
            console.error('FileReader error:', reader.error);
            this.visualizer.showMessage('Error reading file', 'error');
        };

        reader.onabort = () => {
            this.visualizer.showMessage('File reading was aborted', 'warning');
        };

        reader.readAsText(file);
    }

    isValidDotContent(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const trimmedContent = content.trim();

        // Check for basic DOT structure using global patterns
        const hasGraphKeyword = /\b(graph|digraph)\b/i.test(trimmedContent);
        const hasOpeningBrace = trimmedContent.includes('{');
        const hasClosingBrace = trimmedContent.includes('}');

        return hasGraphKeyword && hasOpeningBrace && hasClosingBrace;
    }
}
