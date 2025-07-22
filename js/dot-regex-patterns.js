// DOT Language Regular Expression Patterns
// Global regex patterns for parsing DOT file values and structures

export const DOT_PATTERNS = {
    // DOT value patterns - handles simple values, quoted values, and angle bracket values
    VALUE: {
        // Simple value: alphanumeric, underscore, hyphen, dot
        SIMPLE: /[a-zA-Z0-9_\-\.]+/,

        // Double quoted value: "anything inside quotes"
        DOUBLE_QUOTED: /"([^"]*)"/,

        // Angle bracket value: <anything inside angle brackets>
        ANGLE_BRACKET: /<([^>]*)>/,

        // Combined pattern for any DOT value (simple, quoted, or angle bracket)
        ANY: /(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))/,

        // Global pattern for matching any value
        ANY_GLOBAL: /(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))/g
    },

    // Node identifier patterns
    NODE_ID: {
        // Basic node ID pattern
        BASIC: /([a-zA-Z0-9_\-\.]+)/,

        // Node ID with value pattern (simple, quoted, or angle bracket)
        WITH_VALUE: /(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))/,

        // Node definition pattern with attributes
        DEFINITION: /^\s*(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))\s*\[/
    },

    // Edge patterns
    EDGE: {
        // Edge connector patterns
        CONNECTOR: /(-[->]|--)/,

        // Basic edge pattern (node1 -> node2 or node1 -- node2)
        BASIC: /(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))\s*(-[->]|--)\s*(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))/,

        // Edge definition with attributes
        DEFINITION: /^\s*(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))\s*(-[->]|--)\s*(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))\s*\[/,

        // Edge with attributes for filtering (global)
        WITH_ATTRIBUTES: /(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))\s*(?:->|--)\s*(?:"([^"]*)"|<([^>]*)>|([a-zA-Z0-9_\-\.]+))\s*\[([^\]]+)\]/g
    },

    // Attribute patterns
    ATTRIBUTE: {
        // Attribute key pattern
        KEY: /(\w+)/,

        // Attribute value pattern (handles all value types)
        // Fixed to properly handle unquoted values with special characters
        VALUE: /(?:"([^"]*)"|<([^>]*)>|([^,;]+?)(?=\s*[,;\]]|$))/,

        // Complete attribute pattern (key = value)
        // Uses lookahead to properly capture unquoted values with special characters
        COMPLETE: /(\w+)\s*=\s*(?:"([^"]*)"|<([^>]*)>|([^,;]+?)(?=\s*[,;\]]|$))/,

        // Global attribute pattern
        COMPLETE_GLOBAL: /(\w+)\s*=\s*(?:"([^"]*)"|<([^>]*)>|([^,;]+?)(?=\s*[,;\]]|$))/g,

        // Label attribute specifically
        // Fixed to handle unquoted values with special characters
        LABEL: /label\s*=\s*(?:"([^"]*)"|<([^>]*)>|([^,;]+?)(?=\s*[,;\]]|$))/
    },

    // Common utility patterns
    UTILITY: {
        // Whitespace
        WHITESPACE: /\s+/g,

        // Line breaks
        LINE_BREAK: /\r?\n/,

        // Brackets
        OPEN_BRACKET: /\[/g,
        CLOSE_BRACKET: /\]/g,

        // Semicolon at end
        TRAILING_SEMICOLON: /;\s*$/,

        // DOT keywords to exclude
        KEYWORDS: /^(graph|digraph|subgraph|node|edge)$/i
    }
};

// Helper functions for extracting values from regex matches
export const DOT_VALUE_EXTRACTORS = {
    /**
     * Extract value from a regex match that uses the ANY value pattern
     * @param {Array} match - Regex match array
     * @param {number} startIndex - Starting index for value capture groups (default: 1)
     * @returns {string} Extracted value
     */
    extractValue(match, startIndex = 1) {
        if (!match) return '';

        // Check for double quoted value (capture group 1)
        if (match[startIndex]) return match[startIndex];

        // Check for angle bracket value (capture group 2)
        if (match[startIndex + 1]) return match[startIndex + 1];

        // Check for simple value (capture group 3)
        if (match[startIndex + 2]) return match[startIndex + 2];

        return '';
    },

    /**
     * Extract node IDs from edge pattern match
     * @param {Array} match - Regex match from EDGE.BASIC or EDGE.DEFINITION pattern
     * @returns {Object} Object with sourceNode, connector, targetNode
     */
    extractEdgeNodes(match) {
        if (!match) return { sourceNode: '', connector: '', targetNode: '' };

        const sourceNode = this.extractValue(match, 1);
        const connector = match[4]; // Connector is always in position 4
        const targetNode = this.extractValue(match, 5);

        return { sourceNode, connector, targetNode };
    },

    /**
     * Extract attribute key and value from attribute pattern match
     * @param {Array} match - Regex match from ATTRIBUTE.COMPLETE pattern
     * @returns {Object} Object with key and value
     */
    extractAttribute(match) {
        if (!match) return { key: '', value: '' };

        const key = match[1];
        const value = this.extractValue(match, 2);

        return { key, value };
    }
};

// Validation functions
export const DOT_VALIDATORS = {
    /**
     * Check if a string is a valid DOT identifier
     * @param {string} identifier - String to validate
     * @returns {boolean} True if valid
     */
    isValidIdentifier(identifier) {
        if (!identifier || typeof identifier !== 'string') return false;

        // Check if it matches any of the value patterns
        const simpleMatch = DOT_PATTERNS.VALUE.SIMPLE.test(identifier);
        const quotedMatch = DOT_PATTERNS.VALUE.DOUBLE_QUOTED.test(identifier);
        const angleMatch = DOT_PATTERNS.VALUE.ANGLE_BRACKET.test(identifier);

        return simpleMatch || quotedMatch || angleMatch;
    },

    /**
     * Check if a string is a DOT keyword
     * @param {string} str - String to check
     * @returns {boolean} True if it's a keyword
     */
    isKeyword(str) {
        return DOT_PATTERNS.UTILITY.KEYWORDS.test(str);
    }
};

// Edge detection patterns for filtering and coloring
export const DOT_EDGE_DETECTION = {
    // Pattern to detect if a line contains an edge definition with quoted node IDs
    EDGE_WITH_QUOTED_NODES: /(?:"[^"]*"|'[^']*'|<[^>]*>|[a-zA-Z0-9_\-\.]+)\s*(-[->]|--)\s*(?:"[^"]*"|'[^']*'|<[^>]*>|[a-zA-Z0-9_\-\.]+)/,

    // Pattern to detect edge definition at start of line (complete edge pattern)
    EDGE_DEFINITION_START: /^\s*(?:"[^"]*"|'[^']*'|<[^>]*>|[a-zA-Z0-9_\-\.]+)\s*(-[->]|--)\s*(?:"[^"]*"|'[^']*'|<[^>]*>|[a-zA-Z0-9_\-\.]+)/,

    // Pattern to detect attribute assignment at start of line
    ATTRIBUTE_ASSIGNMENT_START: /^\s*\w+\s*=/,

    // Pattern to detect edge connectors outside quotes
    EDGE_CONNECTOR_OUTSIDE_QUOTES: /(?:^|[^"'])[^"']*?(-[->]|--)(?:[^"']*?(?:$|[^"']))/,

    // Pattern to detect node definition lines
    NODE_DEFINITION: /^\s*[a-zA-Z0-9_"<][^-]*\[/,
    NODE_SIMPLE: /^\s*[a-zA-Z0-9_"<][^-]*\s*$/
};

// Edge detection helper functions
export const DOT_EDGE_VALIDATORS = {
    /**
     * Check if a line represents the start of an edge definition
     * @param {string} line - Line to check
     * @returns {boolean} True if line starts an edge definition
     */
    isEdgeDefinitionLine(line) {
        // Skip empty lines and comments
        if (!line || line.startsWith('//') || line.startsWith('#')) {
            return false;
        }

        // Skip lines that are clearly attribute assignments (contain = but not in edge context)
        // Fixed to handle quoted node IDs properly and edge definitions with attributes
        if (line.includes('=') && !line.match(DOT_EDGE_DETECTION.EDGE_WITH_QUOTED_NODES)) {
            return false;
        }

        // Skip lines that start with attribute names followed by =
        if (DOT_EDGE_DETECTION.ATTRIBUTE_ASSIGNMENT_START.test(line)) {
            return false;
        }

        // More precise check: line should look like an edge definition
        return DOT_EDGE_DETECTION.EDGE_DEFINITION_START.test(line);
    },

    /**
     * Check if a line is a node definition
     * @param {string} line - Line to check
     * @returns {boolean} True if line is a node definition
     */
    isNodeDefinitionLine(line) {
        const trimmed = line.trim();
        return DOT_EDGE_DETECTION.NODE_DEFINITION.test(trimmed) ||
            DOT_EDGE_DETECTION.NODE_SIMPLE.test(trimmed) ||
            (trimmed.includes('=') && !trimmed.includes('->') && !trimmed.includes('--'));
    }
};
