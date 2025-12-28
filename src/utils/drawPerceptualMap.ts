export function drawPerceptualMap(params: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  project: any;
  prefMap: {
	brandCoords: number[][];
	attrCoords: number[][];
	idealIndex: number | null;
  };
  zoom: number;
  hoverBrandIndex: number | null;
  showAttributes: boolean;
  selectedAttrIds: string[];
}) {
  const {
	ctx,
	canvas,
	project,
	prefMap,
	zoom,
	hoverBrandIndex,
	showAttributes,
	selectedAttrIds,
  } = params;

  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // сетка
  ctx.strokeStyle = '#eef2f7';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 50) {
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, H);
	ctx.stroke();
  }
  for (let y = 0; y <= H; y += 50) {
	ctx.beginPath();
	ctx.moveTo(0, y);
	ctx.lineTo(W, y);
	ctx.stroke();
  }

  // оси
  ctx.strokeStyle = '#C7D4E2';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, H);
  ctx.stroke();

  const { brandCoords, attrCoords, idealIndex } = prefMap;
  const selectedSet = new Set(selectedAttrIds);

  // ВАЖНО:
  // Масштаб теперь НЕ зависит от maxR (никакого maxR в рендере).
  // Координаты должны приходить уже в согласованном масштабе из computePrefMap.
  // IMPORTANT: must be identical in draw and hover logic

  const scale = Math.min(W, H) * 0.45 * zoom;

  // бренды
  ctx.font = '12px system-ui';
  project.brands.forEach((b: any, i: number) => {
	const [bx, by] = brandCoords[i] ?? [0, 0];
	const x = cx + bx * scale;
	const y = cy - by * scale;

	const isHover = hoverBrandIndex === i;

	ctx.beginPath();
	ctx.fillStyle = isHover ? '#ff7b00' : (b.color || '#0D1B2A');
	ctx.arc(x, y, isHover ? 7 : 5, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = '#111';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'bottom';
	ctx.fillText(b.name, x + 8, y - 4);
  });

  // атрибуты
  if (showAttributes) {
	ctx.font = '11px system-ui';
	project.attributes.forEach((a: any, j: number) => {
	  if (!a) return;
	  if (!selectedSet.has(a.id)) return;

	  const [ax, ay] = attrCoords[j] ?? [0, 0];
	  const x = cx + ax * scale;
	  const y = cy - ay * scale;

	  ctx.strokeStyle = '#2CAFBF';
	  ctx.lineWidth = 1.5;
	  
	  // точка на конце (опционально)
	  ctx.beginPath();
	  ctx.arc(x, y, 3, 0, Math.PI * 2);
	  ctx.fillStyle = '#2CAFBF';
	  ctx.fill();

	  ctx.fillStyle = '#333';
	  ctx.textAlign = 'left';
	  ctx.textBaseline = 'top';
	  const label = project.lang === 'es' ? a.labelEs : a.labelEn;
	  ctx.fillText(label, x + 6, y + 2);
	});
  }

  // лучи при hover
  if (
	hoverBrandIndex !== null &&
	hoverBrandIndex >= 0 &&
	hoverBrandIndex < project.brands.length
  ) {
	const [bx, by] = brandCoords[hoverBrandIndex] ?? [0, 0];
	const bxCanvas = cx + bx * scale;
	const byCanvas = cy - by * scale;

	if (idealIndex !== null && idealIndex >= 0) {
	  const [ix, iy] = brandCoords[idealIndex] ?? [0, 0];
	  const ixCanvas = cx + ix * scale;
	  const iyCanvas = cy - iy * scale;

	  const dx = bx - ix;
	  const dy = by - iy;
	  const dist = Math.sqrt(dx * dx + dy * dy);

	  ctx.strokeStyle = '#ff7b00';
	  ctx.lineWidth = 1.5;
	  ctx.setLineDash([6, 4]);
	  ctx.beginPath();
	  ctx.moveTo(bxCanvas, byCanvas);
	  ctx.lineTo(ixCanvas, iyCanvas);
	  ctx.stroke();
	  ctx.setLineDash([]);

	  ctx.fillStyle = '#ff7b00';
	  ctx.font = '11px system-ui';
	  ctx.textAlign = 'center';
	  ctx.textBaseline = 'bottom';
	  ctx.fillText(
		`IDEAL: ${dist.toFixed(2)}`,
		(bxCanvas + ixCanvas) / 2,
		(byCanvas + iyCanvas) / 2 - 4,
	  );
	}

	project.attributes.forEach((a: any, j: number) => {
	  if (!a) return;
	  if (!selectedSet.has(a.id)) return;

	  const [ax, ay] = attrCoords[j] ?? [0, 0];
	  const axCanvas = cx + ax * scale;
	  const ayCanvas = cy - ay * scale;

	  const dx = bx - ax;
	  const dy = by - ay;
	  const dist = Math.sqrt(dx * dx + dy * dy);

	  ctx.strokeStyle = '#999';
	  ctx.lineWidth = 1;
	  ctx.beginPath();
	  ctx.moveTo(bxCanvas, byCanvas);
	  ctx.lineTo(axCanvas, ayCanvas);
	  ctx.stroke();

	  ctx.fillStyle = '#555';
	  ctx.font = '10px system-ui';
	  ctx.textAlign = 'center';
	  ctx.textBaseline = 'top';
	  const label = `${project.lang === 'es' ? a.labelEs : a.labelEn}: ${dist.toFixed(2)}`;
	  ctx.fillText(
		label,
		(bxCanvas + axCanvas) / 2,
		(byCanvas + ayCanvas) / 2 + 2,
	  );
	});
  }
}