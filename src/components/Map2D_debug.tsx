// src/components/Map2D_debug.tsx
// ⚠️ DEBUG-версия. Используется ТОЛЬКО как источник данных для Direct Map.
// ⚠️ Основной Map2D.tsx НЕ ТРОГАЕМ.

import React, { useEffect, useMemo } from 'react';
import { useApp } from '../store';

/* ------------------------------------------------------------------ */
/* DEBUG-ВЫХОД ДАННЫХ ДЛЯ DIRECT MAP                                   */
/* ------------------------------------------------------------------ */

export let __DEBUG_directData:
  | {
	  perfMeans: number[][];
	  brands: any[];
	  attributes: any[];
	}
  | null = null;

/* ------------------------------------------------------------------ */
/* ВАЖНО                                                               */
/* Мы НЕ рисуем карту, НЕ используем canvas и НЕ вмешиваемся в UI.     */
/* Этот компонент нужен только чтобы один раз вычислить perfMeans      */
/* ровно так же, как это делает Map2D.                                 */
/* ------------------------------------------------------------------ */

/* --------------------- ВЫРЕЗКА МАТЕМАТИКИ ИЗ Map2D ------------------ */
/* Ниже — ТА ЖЕ computePrefMap, без изменений логики                   */
/* ------------------------------------------------------------------ */

function computePrefMap(project: ReturnType<typeof useApp>['project']) {
  const brands = project.brands;
  const attrs = project.attributes;

  const B = brands.length;
  const A = attrs.length;

  if (B === 0 || A === 0) {
	return {
	  perfMeans: [],
	};
  }

  // 1) Средние оценки performance по брендам и атрибутам (1–5)
  const perfMeans: number[][] = brands.map((b) =>
	attrs.map((a) => {
	  const vals = project.responses.map(
		(r) => r.performance[b.name]?.[a.id] ?? 3,
	  );
	  if (vals.length === 0) return 3;
	  return vals.reduce((s, x) => s + x, 0) / vals.length;
	}),
  );
    
  return { perfMeans };
}


/* ----------------------------- COMPONENT ---------------------------- */

export const Map2D_debug: React.FC = () => {
  const { project } = useApp();

  const debug = useMemo(() => computePrefMap(project), [project]);

  useEffect(() => {
	__DEBUG_directData = {
	  perfMeans: debug.perfMeans,
	  brands: project.brands,
	  attributes: project.attributes,
	};
  }, [debug, project]);

  // НИЧЕГО НЕ РЕНДЕРИМ
  return null;
};