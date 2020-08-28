import { SourceLocation } from './ast';

export const enum ErrorCodes {
    // parse errors
    ABRUPT_CLOSING_OF_EMPTY_COMMENT,
    CDATA_IN_HTML_CONTENT,
    DUPLICATE_ATTRIBUTE,
    END_TAG_WITH_ATTRIBUTES,
    END_TAG_WITH_TRAILING_SOLIDUS,
    EOF_BEFORE_TAG_NAME,
    EOF_IN_CDATA,
    EOF_IN_COMMENT,
    EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT,
    EOF_IN_TAG,
    INCORRECTLY_CLOSED_COMMENT,
    INCORRECTLY_OPENED_COMMENT,
    INVALID_FIRST_CHARACTER_OF_TAG_NAME,
    MISSING_ATTRIBUTE_VALUE,
    MISSING_END_TAG_NAME,
    MISSING_WHITESPACE_BETWEEN_ATTRIBUTES,
    NESTED_COMMENT,
    UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
    UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
    UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
    UNEXPECTED_NULL_CHARACTER,
    UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
    UNEXPECTED_SOLIDUS_IN_TAG,

    // Vue-specific parse errors
    X_INVALID_END_TAG,
    X_MISSING_END_TAG,
}

export const errorMessages: { [code: number]: string } = {
    // parse errors
    [ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT]: 'Illegal comment.',
    [ErrorCodes.CDATA_IN_HTML_CONTENT]:
    'CDATA section is allowed only in XML context.',
    [ErrorCodes.DUPLICATE_ATTRIBUTE]: 'Duplicate attribute.',
    [ErrorCodes.END_TAG_WITH_ATTRIBUTES]: 'End tag cannot have attributes.',
    [ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS]: "Illegal '/' in tags.",
    [ErrorCodes.EOF_BEFORE_TAG_NAME]: 'Unexpected EOF in tag.',
    [ErrorCodes.EOF_IN_CDATA]: 'Unexpected EOF in CDATA section.',
    [ErrorCodes.EOF_IN_COMMENT]: 'Unexpected EOF in comment.',
    [ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT]:
    'Unexpected EOF in script.',
    [ErrorCodes.EOF_IN_TAG]: 'Unexpected EOF in tag.',
    [ErrorCodes.INCORRECTLY_CLOSED_COMMENT]: 'Incorrectly closed comment.',
    [ErrorCodes.INCORRECTLY_OPENED_COMMENT]: 'Incorrectly opened comment.',
    [ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME]:
    "Illegal tag name. Use '&lt;' to print '<'.",
    [ErrorCodes.MISSING_ATTRIBUTE_VALUE]: 'Attribute value was expected.',
    [ErrorCodes.MISSING_END_TAG_NAME]: 'End tag name was expected.',
    [ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES]:
    'Whitespace was expected.',
    [ErrorCodes.NESTED_COMMENT]: "Unexpected '<!--' in comment.",
    [ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME]:
    'Attribute name cannot contain U+0022 ("), U+0027 (\'), and U+003C (<).',
    [ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE]:
    'Unquoted attribute value cannot contain U+0022 ("), U+0027 (\'), U+003C (<), U+003D (=), and U+0060 (`).',
    [ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME]:
    "Attribute name cannot start with '='.",
    [ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME]:
    "'<?' is allowed only in XML context.",
    [ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG]: "Illegal '/' in tags.",

    // Vue-specific parse errors
    [ErrorCodes.X_INVALID_END_TAG]: 'Invalid end tag.',
    [ErrorCodes.X_MISSING_END_TAG]: 'Element is missing end tag.',
};

export interface CompilerError extends SyntaxError {
    code: number
    loc?: SourceLocation
}

export function createCompilerError<T extends number>(
    code: T,
    loc?: SourceLocation,
    messages?: { [code: number]: string },
    additionalMessage?: string,
): CompilerError {
    const msg = (messages || errorMessages)[code] + (additionalMessage || '');
    const error = new SyntaxError(String(msg)) as CompilerError;
    error.code = code;
    error.loc = loc;
    return error;
}
