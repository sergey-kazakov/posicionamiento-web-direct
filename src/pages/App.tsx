// src/pages/App.tsx
import React, { useState } from 'react';
import { AppProvider, useApp, exportJSON, importJSON } from '../store';

import { Home } from './Home';
import { Designer } from './Designer';
import { Survey } from './Survey';
import { Results } from './Results';

import { Map2D } from '../components/Map2D';
import DirectMapByAttributes from './DirectMapByAttributes';
//import { DirectPCAMap } from './DirectPCAMap';

import { t } from '../i18n';
import Footer from '../components/Footer';

import { Map2D_debug } from '../components/Map2D_debug';

export default function App() {
  return (
	<AppProvider>
	  <AppInner />
	</AppProvider>
  );
}

type View =
  | 'home'
  | 'designer'
  | 'survey'
  | 'map2d'
  | 'directmap'
 // | 'directpca'
  | 'results';

function AppInner() {
  const [view, setView] = useState<View>('home');
  const { project, setProject } = useApp();
  const tr = t(project.lang);

  return (
	<>
	  {/* HEADER */}
	  <header>
		<div
		  className="container"
		  style={{
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
		  }}
		>
		  {/* Левая часть: UAH + логотип */}
		  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
			<div className="uah-logo">UAH</div>

			<div className="app-logo">
			  <div className="logo-wordmark">
				<span className="logo-main">POSICIONA</span>
				<span className="logo-dot" />
				<span className="logo-tail">MIENTO</span>
			  </div>
			  <div className="logo-subtitle">Perceptual Mapping Lab</div>
			</div>
		  </div>

		  {/* Правая часть: язык + импорт/экспорт */}
		  <div
			className="print-hide"
			style={{ display: 'flex', gap: 8, alignItems: 'center' }}
		  >
			<span className="hint">{tr.language}:</span>

			<select
			  value={project.lang}
			  onChange={(e) =>
				setProject({ ...project, lang: e.target.value as any })
			  }
			>
			  <option value="es">{tr.es}</option>
			  <option value="en">{tr.en}</option>
			</select>

			{/* JSON controls moved to Survey page */}
			{/* <button className="btn" onClick={() => exportJSON(project)}>
			  {tr.export}
			</button>

			<label className="btn">
			  <input
				type="file"
				accept="application/json"
				style={{ display: 'none' }}
				onChange={(e) => {
				  const f = e.target.files?.[0];
				  if (f) importJSON(f, setProject);
				}}
			  />
			  {tr.import}
			</label> */}
		  </div>
		</div>
	  </header>

	  {/* MAIN CONTENT */}
	  <div className="container">
		{/* НАВИГАЦИЯ */}
		<div className="grid print-hide">
		  <button className="btn" onClick={() => setView('home')}>
			{tr.home}
		  </button>

		  <button className="btn" onClick={() => setView('designer')}>
			{tr.designer}
		  </button>

		  <button className="btn" onClick={() => setView('survey')}>
			{tr.survey}
		  </button>

		  <button className="btn" onClick={() => setView('map2d')}>
			{tr.map2d}
		  </button>

		  <button className="btn" onClick={() => setView('directmap')}>
			{tr.directAttributesMap}
		  </button>
		  
		  {/* <button className="btn" onClick={() => setView('directpca')}>
			{tr.directPCAMap}
		  </button> */}

		  <button className="btn" onClick={() => setView('results')}>
			{tr.results}
		  </button>
		</div>

		{/* ЭКРАНЫ */}
		{view === 'home' && <Home />}
		{view === 'designer' && <Designer />}
		{view === 'survey' && <Survey />}
		{view === 'map2d' && <Map2D />}
		{view === 'directmap' && <DirectMapByAttributes />}
		{/* {view === 'directpca' && <DirectPCAMap lang={project.lang} />} */}
		{view === 'results' && <Results setView={setView} />}
	  </div>

	  {/* FOOTER */}
	  <Footer />
		 {/* DEBUG: источник данных для Direct Map */}
		 <Map2D_debug />
	</>
  );
}