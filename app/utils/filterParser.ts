type FieldFilter = {
    field: string;
    expression: string;
}

/**
 * Parses a filter expression and extracts field names and their associated filters
 * Supports:
 * - Arithmetic: +, -, *, /, %, **
 * - Comparison: >, >=, <, <=, ==, !=
 * - Logical: and/&&, or/||, !/not
 * - Containment: in
 * - Grouping: (...)
 * - Attribute access: .attributeName
 */
export function parseFieldFilters(searchFilter: string | undefined): FieldFilter[] {
    if (!searchFilter) return [];
    
    const filters: FieldFilter[] = [];
    
    // Match field patterns considering all supported operators
    const filterRegex = /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>=|<=|>|<|\+|-|\*|\/|%|\*\*|in|not in)\s*([^.]*?)(?=\s+(?:and|or|&&|\|\||\)|$))/gi;
    
    let match;
    while ((match = filterRegex.exec(searchFilter)) !== null) {
        const [_, field, operator, value] = match;
        // Clean up the value, removing any trailing logical operators
        const cleanValue = value.trim().replace(/\s+(and|or|&&|\|\|)$/, '');
        
        filters.push({
            field,
            expression: `${operator.trim()} ${cleanValue}`
        });
    }
    
    return filters;
}

/**
 * Extracts just the field names from a filter expression
 */
export function extractFieldNames(searchFilter: string | undefined): string[] {
    if (!searchFilter) return [];

    const fieldMatches = searchFilter.match(/\.([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    return Array.from(new Set(fieldMatches.map(field => field.substring(1))));
} 