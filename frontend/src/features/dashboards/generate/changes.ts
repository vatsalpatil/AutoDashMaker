/** One instruction for the dashboard editor: a single change as written, several as a numbered list the AI does in one go. */
export const combineChanges = (items: string[]): string =>
  items.length === 1 ? items[0] : `Make all of these changes to the dashboard:\n${items.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
