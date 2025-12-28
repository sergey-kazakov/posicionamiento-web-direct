// src/components/Map2D.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { drawPerceptualMap } from '../utils/drawPerceptualMap';
import { useApp } from '../store';
import { t } from '../i18n';
import { classicalMDS } from '../lib/positioningMath';
import { computeAttrCoordsCustom } from '../lib/positioningMath';
import { normalizeToUnitRadius } from '../lib/positioningMath';
import { SemanticPcaMap } from "./SemanticPcaMap";

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
  
  // 5) Нормализация координат (ЕДИНАЯ)
  const { brandCoordsNorm, attrCoordsNorm } = normalizeToUnitRadius(
    brandCoordsAll,
    attrCoordsRaw
  );
  
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
  console.log("Map2D render");
  
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
  
      {/* ===== ORIGINAL MAP LAYOUT ===== */}
      <div className="map-layout">
        {/* LEFT: MAP */}
        <div className="map-canvas">
          <canvas ref={canvasRef} />
        </div>
  
        {/* RIGHT: SIDEBAR */}
        <div className="map-sidebar">
          <h4>{tr.controls}</h4>
        
          <div>
            <button onClick={() => setZoom(z => z * 1.2)}>+</button>
            <button onClick={() => setZoom(z => z / 1.2)}>-</button>
          </div>
        
          <label>
            <input
              type="checkbox"
              checked={showAttributes}
              onChange={() => setShowAttributes(v => !v)}
            />
            {tr.showAttributes}
          </label>
        
          {project.attributes.map(a => (
            <label key={a.id}>
              <input
                type="checkbox"
                checked={selectedAttrIds.includes(a.id)}
                onChange={() => handleAttrToggle(a.id)}
              />
              {project.lang === 'es' ? a.labelEs : a.labelEn}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};