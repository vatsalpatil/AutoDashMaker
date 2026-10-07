// Click-to-insert building blocks for custom column formulas. `{}` marks where the selected text (or a placeholder) goes.

export interface Snippet { label: string; template: string; hint: string }
export interface Category { id: string; label: string; snippets: Snippet[] }

export const EXPR_CATEGORIES: Category[] = [
  { id: 'math', label: 'Math', snippets: [
    { label: 'Round', template: 'ROUND({}, 2)', hint: 'round to 2 decimals' },
    { label: 'Round to whole', template: 'ROUND({}, 0)', hint: '' },
    { label: 'Round to nearest 10', template: 'ROUND({} / 10) * 10', hint: '' },
    { label: 'Round up', template: 'CEIL({})', hint: 'next whole number' },
    { label: 'Round down', template: 'FLOOR({})', hint: 'previous whole number' },
    { label: 'Cut decimals', template: 'TRUNC({})', hint: 'drop the fraction' },
    { label: 'Absolute', template: 'ABS({})', hint: 'remove the minus sign' },
    { label: 'Sign (-1/0/1)', template: 'SIGN({})', hint: '' },
    { label: 'Add', template: '{} + value', hint: '' },
    { label: 'Subtract', template: '{} - value', hint: '' },
    { label: 'Multiply', template: '{} * value', hint: '' },
    { label: 'Divide safely', template: '{} / NULLIF(value, 0)', hint: 'no divide-by-zero error' },
    { label: 'Whole-number divide', template: '{} // value', hint: 'integer division' },
    { label: 'Remainder', template: 'MOD({}, 2)', hint: 'x modulo 2' },
    { label: 'Average of two', template: '({} + value) / 2', hint: '' },
    { label: 'Percent of total', template: '100.0 * {} / NULLIF(total, 0)', hint: 'share of a total' },
    { label: 'Percent change', template: '100.0 * ({} - old) / NULLIF(old, 0)', hint: 'new vs old' },
    { label: 'Margin %', template: '100.0 * ({} - cost) / NULLIF({}, 0)', hint: '(price - cost) / price' },
    { label: 'Add percent', template: '{} * (1 + 10 / 100.0)', hint: 'e.g. +10% tax' },
    { label: 'Discount', template: '{} * (1 - 10 / 100.0)', hint: 'e.g. -10%' },
    { label: 'Power', template: 'POWER({}, 2)', hint: 'x squared' },
    { label: 'Square root', template: 'SQRT({})', hint: '' },
    { label: 'Cube root', template: 'CBRT({})', hint: '' },
    { label: 'e to the power', template: 'EXP({})', hint: '' },
    { label: 'Natural log', template: 'LN({})', hint: '' },
    { label: 'Log base 10', template: 'LOG10({})', hint: '' },
    { label: 'Log base 2', template: 'LOG2({})', hint: '' },
    { label: 'Keep between', template: 'GREATEST(LEAST({}, 100), 0)', hint: 'clamp to 0..100' },
    { label: 'Biggest of', template: 'GREATEST({}, 0)', hint: '' },
    { label: 'Smallest of', template: 'LEAST({}, 100)', hint: '' },
    { label: 'Sine', template: 'SIN({})', hint: 'radians' }, { label: 'Cosine', template: 'COS({})', hint: '' },
    { label: 'Tangent', template: 'TAN({})', hint: '' }, { label: 'Degrees', template: 'DEGREES({})', hint: 'radians to degrees' },
    { label: 'Radians', template: 'RADIANS({})', hint: '' }, { label: 'Pi', template: 'PI()', hint: '' },
    { label: 'Random 0-1', template: 'RANDOM()', hint: '' },
    { label: 'Factorial', template: 'FACTORIAL({})', hint: '' },
    { label: 'Greatest common divisor', template: 'GCD({}, value)', hint: '' },
    { label: 'Is even', template: 'MOD({}, 2) = 0', hint: 'true / false' },
  ] },
  { id: 'logic', label: 'Logic / CASE', snippets: [
    { label: 'CASE WHEN', template: "CASE WHEN {} > 0 THEN 'yes' ELSE 'no' END", hint: 'if / else' },
    { label: 'Buckets', template: "CASE WHEN {} < 10 THEN 'low' WHEN {} < 100 THEN 'mid' ELSE 'high' END", hint: 'group numbers into labels' },
    { label: 'If empty use', template: 'COALESCE({}, 0)', hint: 'replace NULL' },
    { label: 'Zero to empty', template: 'NULLIF({}, 0)', hint: 'avoid divide-by-zero' },
    { label: 'Biggest of', template: 'GREATEST({}, 0)', hint: 'max of several values' },
    { label: 'Smallest of', template: 'LEAST({}, 100)', hint: 'min of several values' },
    { label: 'AND / OR', template: '({} > 0 AND {} < 100)', hint: 'combine conditions' },
    { label: 'In list', template: "{} IN ('a', 'b')", hint: 'true if the value is listed' },
  ] },
  { id: 'text', label: 'Text', snippets: [
    { label: 'UPPER', template: 'UPPER({})', hint: '' }, { label: 'lower', template: 'LOWER({})', hint: '' },
    { label: 'Trim spaces', template: 'TRIM({})', hint: '' }, { label: 'Length', template: 'LENGTH({})', hint: 'characters' },
    { label: 'Join text', template: "CONCAT({}, ' ', other)", hint: 'glue columns together' },
    { label: 'Part of text', template: 'SUBSTR({}, 1, 3)', hint: 'first 3 characters' },
    { label: 'Replace', template: "REPLACE({}, 'old', 'new')", hint: '' },
    { label: 'Split part', template: "SPLIT_PART({}, '-', 1)", hint: 'text before the first -' },
    { label: 'Regex extract', template: "REGEXP_EXTRACT({}, '[0-9]+')", hint: 'pull out digits' },
    { label: 'Contains', template: "CONTAINS({}, 'abc')", hint: 'true / false' },
  ] },
  { id: 'date', label: 'Date', snippets: [
    { label: 'Year', template: 'YEAR({})', hint: '' }, { label: 'Month', template: 'MONTH({})', hint: '' }, { label: 'Day', template: 'DAY({})', hint: '' },
    { label: 'Start of month', template: "DATE_TRUNC('month', {})", hint: 'also year, week, quarter' },
    { label: 'Days between', template: "DATE_DIFF('day', {}, CURRENT_DATE)", hint: 'age in days' },
    { label: 'Add days', template: '{} + INTERVAL 7 DAY', hint: '' },
    { label: 'Format date', template: "STRFTIME({}, '%Y-%m')", hint: 'e.g. 2024-05' },
    { label: 'Weekday name', template: 'DAYNAME({})', hint: '' }, { label: 'Month name', template: 'MONTHNAME({})', hint: '' },
    { label: 'Today', template: 'CURRENT_DATE', hint: '' },
  ] },
  { id: 'convert', label: 'Convert', snippets: [
    { label: 'To number', template: 'CAST({} AS DOUBLE)', hint: '' }, { label: 'To whole number', template: 'CAST({} AS INTEGER)', hint: '' },
    { label: 'To text', template: 'CAST({} AS VARCHAR)', hint: '' }, { label: 'To date', template: 'CAST({} AS DATE)', hint: '' },
    { label: 'Safe to number', template: 'TRY_CAST({} AS DOUBLE)', hint: 'NULL instead of an error' },
  ] },
];

/** Quick examples shown on an empty formula. */
export const EXPR_EXAMPLES = ['price * quantity', 'revenue - cost', "UPPER(name)", "CASE WHEN amount > 100 THEN 'big' ELSE 'small' END"];

/** Names offered by autocomplete (besides columns): name, one-line signature, group. */
export const FUNCTION_LIST: { name: string; sig: string; group: string }[] = [
  ...['ROUND(x, digits)', 'CEIL(x)', 'CEILING(x)', 'FLOOR(x)', 'TRUNC(x)', 'ABS(x)', 'SIGN(x)', 'POWER(x, y)', 'POW(x, y)', 'SQRT(x)', 'CBRT(x)', 'EXP(x)', 'LN(x)',
    'LOG(x)', 'LOG10(x)', 'LOG2(x)', 'MOD(x, y)', 'GREATEST(a, b)', 'LEAST(a, b)', 'SIN(x)', 'COS(x)', 'TAN(x)', 'ASIN(x)', 'ACOS(x)', 'ATAN(x)', 'ATAN2(y, x)',
    'DEGREES(x)', 'RADIANS(x)', 'PI()', 'RANDOM()', 'FACTORIAL(x)', 'GCD(x, y)', 'LCM(x, y)', 'EVEN(x)', 'ISNAN(x)', 'ISINF(x)', 'BIT_COUNT(x)'].map((sig) => ({ name: sig.split('(')[0], sig, group: 'Math' })),
  ...['COALESCE(a, b)', 'NULLIF(a, b)', 'IFNULL(a, b)', 'IF(cond, a, b)', 'CASE WHEN cond THEN a ELSE b END', 'TRY_CAST(x AS type)', 'CAST(x AS type)'].map((sig) => ({ name: sig.split('(')[0].split(' ')[0], sig, group: 'Logic' })),
  ...['UPPER(s)', 'LOWER(s)', 'TRIM(s)', 'LTRIM(s)', 'RTRIM(s)', 'LENGTH(s)', 'CONCAT(a, b)', 'SUBSTR(s, start, len)', 'LEFT(s, n)', 'RIGHT(s, n)', 'REPLACE(s, from, to)',
    'SPLIT_PART(s, sep, n)', 'REGEXP_EXTRACT(s, pattern)', 'REGEXP_MATCHES(s, pattern)', 'CONTAINS(s, part)', 'STARTS_WITH(s, p)', 'ENDS_WITH(s, p)', 'REVERSE(s)',
    'LPAD(s, n, pad)', 'RPAD(s, n, pad)', 'INITCAP(s)', 'REPEAT(s, n)', 'STRFTIME(d, format)'].map((sig) => ({ name: sig.split('(')[0], sig, group: 'Text' })),
  ...['YEAR(d)', 'MONTH(d)', 'DAY(d)', 'HOUR(d)', 'MINUTE(d)', 'QUARTER(d)', 'WEEK(d)', 'DAYOFWEEK(d)', 'DAYOFYEAR(d)', 'DAYNAME(d)', 'MONTHNAME(d)', "DATE_TRUNC('month', d)",
    "DATE_DIFF('day', a, b)", "DATE_ADD(d, INTERVAL 1 DAY)", "DATE_PART('year', d)", 'CURRENT_DATE', 'NOW()', 'LAST_DAY(d)', 'MAKE_DATE(y, m, d)'].map((sig) => ({ name: sig.split('(')[0], sig, group: 'Date' })),
];
