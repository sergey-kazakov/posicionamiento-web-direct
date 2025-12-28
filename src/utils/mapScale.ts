export function getMapTransform(
  canvas: HTMLCanvasElement,
  zoom: number
) {
  const W = canvas.width;
  const H = canvas.height;

  return {
	cx: W / 2,
	cy: H / 2,
	scale: Math.min(W, H) * 0.45 * zoom,
  };
}