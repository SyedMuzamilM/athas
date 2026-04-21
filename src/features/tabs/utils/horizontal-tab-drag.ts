export interface PointerPosition {
  x: number;
  y: number;
}

export function constrainHorizontalTabDrag(
  pointer: PointerPosition,
  startY: number,
  containerRect: DOMRect,
  slop = 80,
): { position: PointerPosition; isOutsideRail: boolean } {
  const isOutsideRail =
    pointer.y < containerRect.top - slop || pointer.y > containerRect.bottom + slop;

  if (isOutsideRail) {
    return {
      position: pointer,
      isOutsideRail: true,
    };
  }

  return {
    position: {
      x: pointer.x,
      y: startY,
    },
    isOutsideRail: false,
  };
}
