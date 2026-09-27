/**
 * DOM elements for player name labels, positioned imperatively every frame by the
 * canvas so the labels track the 3D characters without React re-renders.
 */
const elements = new Map<string, HTMLDivElement>()

export function registerLabel(userId: string, element: HTMLDivElement | null): void {
  if (element === null) {
    elements.delete(userId)
    return
  }
  elements.set(userId, element)
}

export function getLabelElements(): ReadonlyMap<string, HTMLDivElement> {
  return elements
}
