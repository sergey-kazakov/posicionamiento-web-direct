import React, { createContext, useContext, useState } from 'react';
import type { Lang } from './i18n';

/* ========= Types ========= */

export type Attribute = {
  id: string;
  labelEs: string;
  labelEn: string;
  reversed?: boolean;
};

export type BrandStyle = {
  name: string;
  color?: string;
};

export type SurveyResponse = {
  importance: Record<string, number>;
  performance: Record<string, Record<string, number>>;
  ts: number;
};

export type Project = {
  id: string;
  lang: Lang;
  
  product?: {
	  es: string;
	  en: string;
	};
  
  brands: BrandStyle[];
  attributes: Attribute[];
  benchmark?: string;
  responses: SurveyResponse[];
  results?: any[];
  
  surveySession?: {
	url?: string;        // ссылка Google Form
	qrImage?: string;    // base64, если загрузили картинку
  };

  directMapByAttributes?: {
	selectedAttrIds: string[];
	activePair: [string, string] | null;
  };

  prefMap?: {
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
};

// IMPORTANT: setProject supports both full Project object and functional updater

type Ctx = {
  project: Project;
  setProject: (p: Project | ((prev: Project) => Project)) => void;
};

/* ========= Default seed ========= */

const seed: Project = {
  id: 'demo',
  lang: 'es',
  
  product: {
	  es: '',
	  en: '',
	},
	
  brands: [
	{ name: 'Don Simon', color: '#0D1B2A' },
	{ name: 'Hacendado' },
	{ name: 'Alpiendo' },
	{ name: 'Granini' },
	{ name: 'IDEAL', color: '#2CAFBF' },
  ],
  attributes: [
	{ id: 'taste', labelEs: 'Sabor', labelEn: 'Taste' },
	{ id: 'pack', labelEs: 'Envase útil', labelEn: 'Convenient packaging' },
	{ id: 'nat', labelEs: 'Naturalidad (%)', labelEn: 'Naturalness (%)' },
	{ id: 'nopulp', labelEs: 'Sin poso', labelEn: 'No pulp/residue' },
	{ id: 'color', labelEs: 'Color', labelEn: 'Color' },
	{ id: 'price', labelEs: 'Precio', labelEn: 'Price', reversed: true },
	{ id: 'aroma', labelEs: 'Aroma', labelEn: 'Smell' },
  ],
  benchmark: 'IDEAL',
  responses: [],
  results: [],
};

/* ========= Context ========= */

export const AppCtx = createContext<Ctx>({
  project: seed,
  setProject: () => {},
});

export function useApp() {
  return useContext(AppCtx);
}

/* ========= Provider ========= */

const STORAGE_KEY = 'posicionamiento_project_v3';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const saved = localStorage.getItem(STORAGE_KEY);

  let initialProject: Project = seed;
  if (saved) {
	try {
	  const parsed = JSON.parse(saved);
	  if (parsed && typeof parsed === 'object') {
		initialProject = parsed;
	  }
	} catch {
	  localStorage.removeItem(STORAGE_KEY);
	  initialProject = seed;
	}
  }

  const [project, setProjectState] = useState<Project>(initialProject);
  
  function setProject(
	updater: Project | ((prev: Project) => Project)
  ) {
	setProjectState((prev) => {
	  const next =
		typeof updater === 'function'
		  ? updater(prev)
		  : updater;
  
	  if (!next || typeof next !== 'object') return prev;
  
	  // 🔒 idempotency guard — КЛЮЧЕВОЕ МЕСТО
	  if (JSON.stringify(prev) === JSON.stringify(next)) {
		return prev;
	  }
  
	  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	  return next;
	});
  }

  return (
	<AppCtx.Provider value={{ project, setProject }}>
	  {children}
	</AppCtx.Provider>
  );
}

/* ========= Import / Export ========= */

export function exportJSON(p: Project) {
  const blob = new Blob([JSON.stringify(p, null, 2)], {
	type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'posicionamiento_project.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file: File, cb: (p: Project) => void) {
  const r = new FileReader();
  r.onload = () => {
	try {
	  const parsed = JSON.parse(String(r.result));
	  if (parsed && typeof parsed === 'object') {
		cb(parsed);
	  } else {
		alert('JSON inválido');
	  }
	} catch {
	  alert('JSON inválido');
	}
  };
  r.readAsText(file);
}