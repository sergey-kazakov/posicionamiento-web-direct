

// классический MDS для симметричной матрицы расстояний D (n×n)
export function classicalMDS(dist: number[][]): number[][] {
  const n = dist.length;
  if (n === 0) return [];

  // Квадраты расстояний
  const d2: number[][] = Array.from({ length: n }, (_, i) =>
	Array.from({ length: n }, (_, j) => dist[i][j] * dist[i][j]),
  );

  // Средние по строкам / столбцам / всему
  const rowMean = new Array<number>(n).fill(0);
  const colMean = new Array<number>(n).fill(0);
  let totalMean = 0;

  for (let i = 0; i < n; i++) {
	for (let j = 0; j < n; j++) {
	  rowMean[i] += d2[i][j];
	  colMean[j] += d2[i][j];
	  totalMean += d2[i][j];
	}
  }
  for (let i = 0; i < n; i++) rowMean[i] /= n;
  for (let j = 0; j < n; j++) colMean[j] /= n;
  totalMean /= n * n;

  // Матрица B = -0.5 * J D^2 J (double-centering)
  const B: number[][] = Array.from({ length: n }, () =>
	new Array<number>(n).fill(0),
  );
  for (let i = 0; i < n; i++) {
	for (let j = 0; j < n; j++) {
	  B[i][j] = -0.5 * (d2[i][j] - rowMean[i] - colMean[j] + totalMean);
	}
  }

  // Вспомогательная: B * v
  const mul = (v: number[]): number[] => {
	const res = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
	  let s = 0;
	  for (let j = 0; j < n; j++) s += B[i][j] * v[j];
	  res[i] = s;
	}
	return res;
  };

  // Норма и нормировка
  const norm = (v: number[]): number =>
	Math.sqrt(v.reduce((s, x) => s + x * x, 0));

  // Power iteration для наибольшего собственного вектора
  const powerIteration = (maxIter = 100): { lambda: number; vec: number[] } => {
	let v = new Array<number>(n).fill(1 / Math.sqrt(n));
	let lambda = 0;
	for (let it = 0; it < maxIter; it++) {
	  const Bv = mul(v);
	  const nv = norm(Bv);
	  if (nv === 0) break;
	  v = Bv.map((x) => x / nv);
	  lambda = v.reduce((s, x, i) => s + x * Bv[i], 0);
	}
	return { lambda, vec: v };
  };

  // Первый собственный вектор
  const { lambda: lambda1, vec: v1 } = powerIteration();

  // Дефляция
  const B2: number[][] = Array.from({ length: n }, (_, i) =>
	Array.from({ length: n }, (_, j) => B[i][j] - lambda1 * v1[i] * v1[j]),
  );

  const mul2 = (v: number[]): number[] => {
	const res = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
	  let s = 0;
	  for (let j = 0; j < n; j++) s += B2[i][j] * v[j];
	  res[i] = s;
	}
	return res;
  };

  const powerIteration2 = (maxIter = 100): { lambda: number; vec: number[] } => {
	let v = new Array<number>(n).fill(1 / Math.sqrt(n));
	let lambda = 0;
	for (let it = 0; it < maxIter; it++) {
	  const Bv = mul2(v);
	  const nv = norm(Bv);
	  if (nv === 0) break;
	  v = Bv.map((x) => x / nv);
	  lambda = v.reduce((s, x, i) => s + x * Bv[i], 0);
	}
	return { lambda, vec: v };
  };

  const { lambda: lambda2, vec: v2 } = powerIteration2();

  const coords: number[][] = Array.from({ length: n }, () => [0, 0]);
  const s1 = lambda1 > 0 ? Math.sqrt(lambda1) : 0;
  const s2 = lambda2 > 0 ? Math.sqrt(lambda2) : 0;

  for (let i = 0; i < n; i++) {
	coords[i][0] = v1[i] * s1;
	coords[i][1] = v2[i] * s2;
  }

  return coords;
}

/* ----------------- КАСТОМНАЯ ФОРМУЛА ДЛЯ АТРИБУТОВ ----------------- */

/**
 * Здесь — единственное место, где задаётся положение атрибутов.
 * Ты можешь ПОЛНОСТЬЮ переписать тело функции под свои формулы.
 *
 * Вход:
 *  - perfMeans[b][a]  – средняя оценка атрибута a у бренда b (1–5)
 *  - brandCoords[b]   – 2D координаты бренда b после MDS
 *  - idealIndex       – индекс IDEAL или null
 *
 * Выход:
 *  - attrCoords[a]    – 2D координата атрибута a
 */
export function computeAttrCoordsCustom(
   perfMeans: number[][],
   brandCoords: number[][],
   idealIndex: number | null,
 ): number[][] {
   const B = brandCoords.length;
   const A = perfMeans[0]?.length ?? 0;
   const attrs: number[][] = Array.from({ length: A }, () => [0, 0]);
   if (A === 0 || B === 0) return attrs;
 
   // --------- ПАРАМЕТРЫ, С КОТОРЫМИ МОЖНО "ИГРАТЬ" ---------
   const weightGamma = 0.5;   // >1 => сильнее тянет к бренду-лидеру по атрибуту
   const stretch = 1.15;      // чуть раздуваем от брендов
   const betaIdeal = 1.00;    // влияние разницы IDEAL – среднее по атрибуту
   const repelRadius = 7.0;  // минимальное желаемое расстояние между атрибутами
   const repelStrength = 0.7; // сила отталкивания (0.2–0.6 нормально)
   // --------------------------------------------------------
 
   // --- Позиция IDEAL и центр остальных брендов ---
   let idealX = 0;
   let idealY = 0;
   let hasIdeal = false;
 
   if (idealIndex !== null && idealIndex >= 0 && idealIndex < B) {
	 idealX = brandCoords[idealIndex][0];
	 idealY = brandCoords[idealIndex][1];
	 hasIdeal = true;
   }
 
   let centerX = 0;
   let centerY = 0;
   let centerCnt = 0;
   for (let b = 0; b < B; b++) {
	 if (hasIdeal && b === idealIndex) continue;
	 centerX += brandCoords[b][0];
	 centerY += brandCoords[b][1];
	 centerCnt++;
   }
   if (centerCnt > 0) {
	 centerX /= centerCnt;
	 centerY /= centerCnt;
   }
 
   // Направление "к IDEAL" (общее)
   let dirX = 0;
   let dirY = 0;
   if (hasIdeal) {
	 dirX = idealX - centerX;
	 dirY = idealY - centerY;
	 const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
	 dirX /= len;
	 dirY /= len;
   }
 
   // --------- 1. Базовые позиции атрибутов (центроид + IDEAL) ----------
   for (let a = 0; a < A; a++) {
	 let cx = 0;
	 let cy = 0;
	 let sumW = 0;
 
	 let sumOthers = 0;
	 let cntOthers = 0;
 
	 for (let b = 0; b < B; b++) {
	   const score = perfMeans[b][a]; // 1..5
	   const scoreForWeight = Math.max(score - 1, 0.0001); // чуть смещаем, чтобы 1 не был нулём
	   const w = Math.pow(scoreForWeight, weightGamma);    // нелинейный вес
 
	   if (hasIdeal && b === idealIndex) {
		 // IDEAL не участвует в базовом центроиде
	   } else {
		 cx += w * brandCoords[b][0];
		 cy += w * brandCoords[b][1];
		 sumW += w;
 
		 sumOthers += score;
		 cntOthers++;
	   }
	 }
 
	 if (sumW > 0) {
	   cx /= sumW;
	   cy /= sumW;
	 }
 
	 // 2. Смещение вдоль направления к IDEAL в зависимости от того,
	 // насколько IDEAL лучше/хуже среднего по атрибуту
	 let offsetX = 0;
	 let offsetY = 0;
	 if (hasIdeal && cntOthers > 0) {
	   const meanOthers = sumOthers / cntOthers;
	   const idealScore = perfMeans[idealIndex!][a];
	   const diff = idealScore - meanOthers; // >0 — IDEAL лучше
 
	   offsetX = dirX * diff * betaIdeal;
	   offsetY = dirY * diff * betaIdeal;
	 }
 
	 attrs[a][0] = cx * stretch + offsetX;
	 attrs[a][1] = cy * stretch + offsetY;
   }
 
   // --------- 2. Лёгкое "расталкивание" атрибутов ---------
   const iters = 3; // 2–4 итераций достаточно
   for (let it = 0; it < iters; it++) {
	 for (let i = 0; i < A; i++) {
	   for (let j = i + 1; j < A; j++) {
		 let dx = attrs[j][0] - attrs[i][0];
		 let dy = attrs[j][1] - attrs[i][1];
		 const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6;
 
		 if (dist < repelRadius) {
		   // Насколько надо раздвинуть
		   const force = ((repelRadius - dist) / repelRadius) * repelStrength;
		   dx /= dist;
		   dy /= dist;
 
		   // двигаем симметрично
		   attrs[i][0] -= dx * force;
		   attrs[i][1] -= dy * force;
		   attrs[j][0] += dx * force;
		   attrs[j][1] += dy * force;
		 }
	   }
	 }
   }
 
   return attrs;
 }
 
 export function normalizeToUnitRadius(
   brandCoords: number[][],
   attrCoords: number[][]
 ): {
   brandCoordsNorm: number[][];
   attrCoordsNorm: number[][];
 } {
   let maxR = 1e-6;
 
   for (const [x, y] of brandCoords) {
	 const r = Math.sqrt(x * x + y * y);
	 if (r > maxR) maxR = r;
   }
 
   for (const [x, y] of attrCoords) {
	 const r = Math.sqrt(x * x + y * y);
	 if (r > maxR) maxR = r;
   }
 
   return {
	 brandCoordsNorm: brandCoords.map(([x, y]) => [x / maxR, y / maxR]),
	 attrCoordsNorm:  attrCoords.map(([x, y]) => [x / maxR, y / maxR]),
   };
 }
 
 export function normalizeToPositiveQuadrant(
   points: number[][]
 ): number[][] {
   if (points.length === 0) return points;
 
   let minX = Infinity;
   let minY = Infinity;
 
   for (const [x, y] of points) {
	 if (x < minX) minX = x;
	 if (y < minY) minY = y;
   }
 
   return points.map(([x, y]) => [
	 x - minX,
	 y - minY,
   ]);
 }