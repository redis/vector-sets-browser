/**
 * Converts a string value to a number if it matches various numeric formats.
 * Handles currency, percentages, scientific notation, and numbers with units.
 * Returns the original value if conversion is not possible.
 */
export function convertToNumericIfPossible(value: string): string | number {
    // Handle empty or non-string values
    if (!value || typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();

    // Handle parenthetical negative numbers e.g., (1,234.56)
    if (/^\([\d,]+(\.\d+)?\)$/.test(trimmed)) {
        const numberPart = trimmed.replace(/[(),]/g, '');
        const parsedNumber = -parseFloat(numberPart);
        return !isNaN(parsedNumber) ? parsedNumber : value;
    }

    // Handle currency values with symbols e.g., $1,234.56, €100.00, -$1,234.56
    if (/^-?[$€£¥][\d,]+(\.\d+)?$/.test(trimmed)) {
        const numberPart = trimmed.replace(/[^-\d.,]/g, '');
        const parsedNumber = parseFloat(numberPart.replace(/,/g, ''));
        return !isNaN(parsedNumber) ? parsedNumber : value;
    }

    // Handle percentage values e.g., 15%, 3.5%
    if (/^-?[\d,]+(\.\d+)?%$/.test(trimmed)) {
        const numberPart = trimmed.replace(/[%,]/g, '');
        const parsedNumber = parseFloat(numberPart) / 100;
        return !isNaN(parsedNumber) ? parsedNumber : value;
    }

    // Handle scientific notation e.g., 1.23e6, -1.23E-6
    if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(trimmed)) {
        const parsedNumber = parseFloat(trimmed);
        return !isNaN(parsedNumber) ? parsedNumber : value;
    }

    // Handle basic comma-separated numbers
    if (/^-?[\d,]+(\.\d+)?$/.test(trimmed)) {
        const numberWithoutCommas = trimmed.replace(/,/g, '');
        const parsedNumber = parseFloat(numberWithoutCommas);
        return !isNaN(parsedNumber) ? parsedNumber : value;
    }

    // Handle numbers with units
    const numberWithUnitsMatch = trimmed.match(/^-?(\d+(?:,\d+)*(?:\.\d+)?)\s+\w+/);
    if (numberWithUnitsMatch) {
        const numberPart = numberWithUnitsMatch[1].replace(/,/g, '');
        const parsedNumber = parseFloat(numberPart);
        return !isNaN(parsedNumber) ? parsedNumber : value;
    }

    return value;
} 