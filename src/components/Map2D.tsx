// src/components/Map2D.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { drawPerceptualMap } from '../utils/drawPerceptualMap';
import { useApp } from '../store';
import { t } from '../i18n';

type PrefMap = {
  brandCoords: number[][];
  attrCoords: number[][];
  idealIndex: number | null;

  tables: {
    performanceMeans: {
      brand: string;
      values: number[];
    }[];

    attributeSensitivity: {
      attribute: string;
      loadingX: number;
      loadingY: number;
      magnitude: number;
    }[];

    distancesToIdeal: {
      brand: string;
      distance: number;
    }[];
  };
};
// IMPORTANT: must be identical in draw and hover logic

const MAP_SCALE_FACTOR = 0.45;

/* ------------------------- математика MDS -------------------------- */

// классический MDS для симметричной матрицы расстояний D (n×n)
function classicalMDS(dist: number[][]): number[][] {
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
function computeAttrCoordsCustom(
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

/* --------------------- расчёт PrefMap из проекта --------------------- */

function computePrefMap(project: ReturnType<typeof useApp>['project']): PrefMap {
  const brands = project.brands;
  const attrs = project.attributes;

  const B = brands.length;
  const A = attrs.length;

  if (B === 0 || A === 0) {
    return {
      brandCoords: [],
      attrCoords: [],
      idealIndex: null,
      tables: {
        performanceMeans: [],
        attributeSensitivity: [],
        distancesToIdeal: [],
      },
    };
  }

  // IDEAL / benchmark
  let idealIndex = -1;
  if (project.benchmark) {
    idealIndex = brands.findIndex(
      (b) => b.name.toUpperCase() === project.benchmark!.toUpperCase(),
    );
  }
  if (idealIndex < 0) {
    idealIndex = brands.findIndex((b) => b.name.toUpperCase().includes('IDEAL'));
  }

  // активные бренды: ВСЕ, включая IDEAL
  const activeBrandIdx: number[] = [];
  for (let i = 0; i < B; i++) {
    activeBrandIdx.push(i);
  }
  const B0 = activeBrandIdx.length; // здесь это просто B

  // 1) Средние оценки performance по брендам и атрибутам
  const perfMeans: number[][] = brands.map((b) =>
    attrs.map((a) => {
      const vals = project.responses.map(
        (r) => r.performance[b.name]?.[a.id] ?? 3,
      );
      if (vals.length === 0) return 3;
      const m = vals.reduce((s, x) => s + x, 0) / vals.length;
      return m;
    }),
  );

  // 2) Стандартизация по НЕ-IDEAL брендам (для MDS)
  const colMean = new Array<number>(A).fill(0);
  const colStd = new Array<number>(A).fill(0);

  for (let a = 0; a < A; a++) {
    let s = 0;
    for (const bi of activeBrandIdx) s += perfMeans[bi][a];
    const denomMean = activeBrandIdx.length || B;
    colMean[a] = s / denomMean;

    let sq = 0;
    for (const bi of activeBrandIdx) {
      const d = perfMeans[bi][a] - colMean[a];
      sq += d * d;
    }
    const denomVar = activeBrandIdx.length || B;
    colStd[a] = Math.sqrt(sq / denomVar) || 1;
  }

  const Xstd: number[][] = perfMeans.map((row) =>
    row.map((v, a) => (v - colMean[a]) / colStd[a]),
  );

  // 3) Матрица расстояний и MDS только по активным брендам
  const dist: number[][] = Array.from({ length: B0 }, () =>
    new Array<number>(B0).fill(0),
  );

  for (let i0 = 0; i0 < B0; i0++) {
    const bi = activeBrandIdx[i0];
    for (let j0 = i0 + 1; j0 < B0; j0++) {
      const bj = activeBrandIdx[j0];
      let s = 0;
      for (let a = 0; a < A; a++) {
        const d = Xstd[bi][a] - Xstd[bj][a];
        s += d * d;
      }
      const d = Math.sqrt(s);
      dist[i0][j0] = dist[j0][i0] = d;
    }
  }

  let brandCoordsAll: number[][] = Array.from({ length: B }, () => [0, 0]);
  
  if (B0 >= 2) {
    const coordsActive = classicalMDS(dist); // длина B0 = B
  
    // просто раскладываем координаты для всех брендов, включая IDEAL
    for (let i0 = 0; i0 < B0; i0++) {
      const bi = activeBrandIdx[i0];
      brandCoordsAll[bi] = coordsActive[i0] ?? [0, 0];
    }
  }

  // 4) АТРИБУТЫ: полностью кастомная формула
  const attrCoordsRaw = computeAttrCoordsCustom(
    perfMeans,
    brandCoordsAll,
    idealIndex >= 0 ? idealIndex : null,
  );

  // 5) Нормировка (чтобы всё помещалось в круг радиуса 1)
  let maxR = 1e-6;
  for (const [x, y] of brandCoordsAll) {
    const r = Math.sqrt(x * x + y * y);
    if (r > maxR) maxR = r;
  }
  for (const [x, y] of attrCoordsRaw) {
    const r = Math.sqrt(x * x + y * y);
    if (r > maxR) maxR = r;
  }

  const brandCoordsNorm = brandCoordsAll.map(([x, y]) => [x / maxR, y / maxR]);
  const attrCoordsNorm = attrCoordsRaw.map(([x, y]) => [x / maxR, y / maxR]);

  // ---------- TABLE 1: Performance means ----------
  const performanceMeansTable = brands.map((b, bi) => ({
    brand: b.name,
    values: perfMeans[bi],
  }));
  
  // ---------- TABLE 2: Attribute sensitivity ----------
  const attributeSensitivityTable = attrs.map((a, ai) => {
    const [x, y] = attrCoordsNorm[ai] ?? [0, 0];
    const magnitude = Math.sqrt(x * x + y * y);
  
    return {
      attribute: project.lang === 'es' ? a.labelEs : a.labelEn,
      loadingX: x,
      loadingY: y,
      magnitude,
    };
  });
  
  // ---------- TABLE 3: Distances to IDEAL ----------
  const distancesToIdealTable: {
    brand: string;
    distance: number;
  }[] = [];
  
  if (idealIndex >= 0) {
    const [ix, iy] = brandCoordsNorm[idealIndex];
  
    brands.forEach((b, bi) => {
      if (bi === idealIndex) return;
      const [x, y] = brandCoordsNorm[bi];
      const d = Math.sqrt((x - ix) ** 2 + (y - iy) ** 2);
  
      distancesToIdealTable.push({
        brand: b.name,
        distance: d,
      });
    });
  }
  
  return {
    brandCoords: brandCoordsNorm,
    attrCoords: attrCoordsNorm,
    idealIndex: idealIndex >= 0 ? idealIndex : null,
  
    tables: {
      performanceMeans: performanceMeansTable,
      attributeSensitivity: attributeSensitivityTable,
      distancesToIdeal: distancesToIdealTable,
    },
  };
}

/* ------------------------------ React-компонент ------------------------------ */

export const Map2D: React.FC = () => {
  const { project, setProject } = useApp();
  const tr = t(project.lang);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hoverBrandIndex, setHoverBrandIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showAttributes, setShowAttributes] = useState(true);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>(
    project.attributes.map((a) => a.id),
  );

  const prefMap = useMemo(() => computePrefMap(project), [project]);
  
  useEffect(() => {
    setProject((prev) => {
      if (prev.prefMap === prefMap) return prev;
      return {
        ...prev,
        prefMap,
      };
    });
  }, [prefMap, setProject]);
  
  useEffect(() => {
    setSelectedAttrIds(project.attributes.map((a) => a.id));
  }, [project.attributes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    drawPerceptualMap({
      ctx,
      canvas,
      project,
      prefMap,
      zoom,
      hoverBrandIndex,
      showAttributes,
      selectedAttrIds,
    });
  }, [project, prefMap, hoverBrandIndex, zoom, showAttributes, selectedAttrIds]);

  // hover
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      
      // переводим mouse → canvas coordinates
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const { brandCoords } = prefMap;
      
      // ВАЖНО: та же система координат, что и в drawPerceptualMap
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const scale = Math.min(W, H) * MAP_SCALE_FACTOR * zoom;

      let found = -1;
      project.brands.forEach((_, i) => {
        const [bx, by] = brandCoords[i] ?? [0, 0];
        const px = cx + bx * scale;
        const py = cy - by * scale;
        const dx = x - px;
        const dy = y - py;
        const BRAND_RADIUS = 5;
        const HOVER_RADIUS = BRAND_RADIUS + 2; // масштабируем вместе с картой
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= HOVER_RADIUS) {
          found = i;
        }
      });

      setHoverBrandIndex(found >= 0 ? found : null);
    };

    const handleLeave = () => setHoverBrandIndex(null);

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, [prefMap, project.brands, zoom]);

  const handleAttrToggle = (id: string) => {
    setSelectedAttrIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="card">
      <h3>
        {project.lang === 'es'
          ? 'Mapa de Posicionamiento'
          : 'Positioning Map'}
      </h3>
  
      <div className="map-layout">
        {/* LEFT: MAP */}
        <div className="map-canvas">
          <canvas
            ref={canvasRef}
            width={900}
            height={600}
            style={{
              width: '900px',
              height: '600px',
              borderRadius: 8,
            }}
          />
  
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12 }}>Zoom:</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <span style={{ fontSize: 12 }}>×{zoom.toFixed(1)}</span>
          </div>
  
          <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
            {project.lang === 'es'
              ? 'Pasa el ratón por las marcas para ver distancias a IDEAL y a los atributos seleccionados.'
              : 'Hover the brands to see distances to IDEAL and selected attributes.'}
          </div>
        </div>
  
        {/* RIGHT: SIDEBAR */}
        <div className="map-sidebar">
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={showAttributes}
                onChange={(e) => setShowAttributes(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              {project.lang === 'es'
                ? 'Mostrar atributos en el mapa'
                : 'Show attributes on map'}
            </label>
          </div>
  
          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
            {project.lang === 'es'
              ? 'Atributos para las líneas de distancia:'
              : 'Attributes for distance lines:'}
          </div>
  
          <div
            style={{
              border: '1px solid #dde3ee',
              borderRadius: 8,
              padding: 8,
              maxHeight: 260,
              overflowY: 'auto',
              fontSize: 11,
            }}
          >
            {project.attributes.map((a) => (
              <label
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAttrIds.includes(a.id)}
                  onChange={() => handleAttrToggle(a.id)}
                />
                <span>
                  {project.lang === 'es' ? a.labelEs : a.labelEn}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export let __DEBUG_normalizedData: any = null;