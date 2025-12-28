import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { __DEBUG_directData } from '../components/Map2D_debug';

type Point = {
  name: string;
  x: number; // 0..1
  y: number; // 0..1
  isIdeal: boolean;
};

const EMPTY_ARRAY: string[] = [];

export default function DirectMapByAttributes() {
  const { project, setProject } = useApp();
  
  const selectedAttrIds =
  project.directMapByAttributes?.selectedAttrIds ?? EMPTY_ARRAY;
  
  const activePair =
	project.directMapByAttributes?.activePair ?? null;

  // ---------- SAFETY ----------
  if (!__DEBUG_directData) {
	return (
	  <div className="page">
		<p style={{ opacity: 0.7 }}>
		  Open Map2D once to initialise Direct Map data.
		</p>
	  </div>
	);
  }

  const { perfMeans, brands, attributes } = __DEBUG_directData;

  // ---------- STATE ----------
 
  const [pairs, setPairs] = useState<[string, string][]>([]);
 
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);

  // ---------- HELPERS ----------
  function toggleAttr(id: string) {
	const prev = selectedAttrIds;
  
	let next: string[];
	if (prev.includes(id)) {
	  next = prev.filter((x) => x !== id);
	} else {
	  if (prev.length >= 4) return;
	  next = [...prev, id];
	}
  
	setProject(prev => ({
	  ...prev,
	  directMapByAttributes: {
		selectedAttrIds: next,
		activePair:
		  next.length === 4
			? generatePairs(next)[0]
			: null,
	  },
	}));
	}

  function generatePairs(ids: string[]): [string, string][] {
	const res: [string, string][] = [];
	for (let i = 0; i < ids.length; i++) {
	  for (let j = i + 1; j < ids.length; j++) {
		res.push([ids[i], ids[j]]);
	  }
	}
	return res;
  }

  function attrLabel(id: string) {
	const a = attributes.find((x: any) => x.id === id);
	if (!a) return id;
	return project.lang === 'es' ? a.labelEs : a.labelEn;
  }

  // ---------- WHEN 4 ATTRIBUTES ----------
  useEffect(() => {
	if (selectedAttrIds.length === 4) {
	  const p = generatePairs(selectedAttrIds);
	  setPairs(p);
	} else {
	  setPairs([]);
	}
  }, [selectedAttrIds]);

  // ---------- BUILD POINTS ----------
  const points: Point[] = useMemo(() => {
	if (!activePair) return [];

	const [aId, bId] = activePair;
	const aIndex = attributes.findIndex((a: any) => a.id === aId);
	const bIndex = attributes.findIndex((a: any) => a.id === bId);

	if (aIndex < 0 || bIndex < 0) return [];

	return brands
	  .map((b: any, i: number) => {
		const vA = perfMeans[i]?.[aIndex];
		const vB = perfMeans[i]?.[bIndex];
		if (vA == null || vB == null) return null;

		// SCALE 1–5 → 0–1
		const x = (vA - 1) / 4;
		const y = (vB - 1) / 4;

		return {
		  name: b.name,
		  x,
		  y,
		  isIdeal: b.name === 'IDEAL',
		} as Point;
	  })
	  .filter((p): p is Point => !!p && p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1);
  }, [activePair, perfMeans, brands, attributes]);

  const idealPoint = useMemo(() => {
	return points.find((p) => p.isIdeal) || null;
  }, [points]);

  function distanceToIdeal(p: { x: number; y: number }) {
	if (!idealPoint) return null;
	const dx = p.x - idealPoint.x;
	const dy = p.y - idealPoint.y;
	return Math.sqrt(dx * dx + dy * dy);
  }
  
  function clamp(v: number, min: number, max: number) {
	return Math.max(min, Math.min(max, v));
  }
  
  function addToResults() {
	if (!activePair || points.length === 0) return;
  
	const payload = {
	  type: 'direct-attributes',
	  attributes: activePair,   // [attrIdX, attrIdY]
	  points,                   // то, что студент реально видит
	  label: `Direct map: ${attrLabel(activePair[0])} × ${attrLabel(activePair[1])}`,
	  createdAt: Date.now(),
	};
  
	// минимально-инвазивно: складируем в project
	(project as any).results = (project as any).results || [];
	(project as any).results.push(payload);
  
	// временно, чтобы ты видел, что сработало
	console.log('Added to Results:', payload);
	alert('Direct map added to Results');
  }

  // ---------- SVG GEOMETRY ----------
  // Простой подход: фиксированные размеры в пикселях, без viewBox
  const SVG_SIZE = 400; // Размер SVG в пикселях (оптимальный для экрана)
  const AXIS_LABEL_OFFSET = 20; // расстояние подписи от оси
  const AXIS_LABEL_FONT = 14;   // размер шрифта осей
  const MARGIN = 5; // Отступы для осей и подписей
  const PLOT_SIZE = SVG_SIZE - 2 * MARGIN; // Область для данных
  const PAD = 10; // // добавим “запас” вокруг, чтобы подписи/точки не резались
  const PLOT_MIN = MARGIN;
  const PLOT_MAX = SVG_SIZE - MARGIN;
  const PLOT_CENTER = SVG_SIZE / 2;

  const xLabel = activePair ? attrLabel(activePair[0]) : '';
  const yLabel = activePair ? attrLabel(activePair[1]) : '';

  return (
	<div className="page">
	  <h1 style={{ marginBottom: -2 }}>
		{project.lang === 'es'
		  ? 'Mapa directo por atributos'
		  : 'Direct Map by Attributes'}
	  </h1>
	  
	  <div
		style={{
		  marginBottom: 20,
		  padding: '12px 16px',
		  background: '#f7f9fc',
		  //border: '1px solid #cfd8e3',
		  borderRadius: 8,
		  fontSize: 15,
		  color: '#333',
		  maxWidth: 760,
		}}
	  >
		{project.lang === 'es' ? (
		  <>
			<strong>Cómo usar el Mapa Directo</strong>
			<ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
			  <li>Seleccione <strong>exactamente cuatro atributos</strong> que considere estratégicamente relevantes.</li>
			  <li>El sistema generará automáticamente <strong>seis mapas directos alternativos</strong>, cada uno basado en un par de atributos.</li>
			  <li>Observe cómo cambian las posiciones de las marcas según las dimensiones seleccionadas.</li>
			  <li>Elija <strong>un mapa</strong> que mejor represente su enfoque analítico y añádalo a Resultados.</li>
			</ol>
			<div style={{ marginTop: 8, fontStyle: 'italic', color: '#555' }}>
			  Diferentes elecciones de atributos conducen a distintas interpretaciones. No existe un mapa “correcto”, sino mapas bien justificados.
			</div>
		  </>
		) : (
		  <>
			<strong>How to use the Direct Map</strong>
			<ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
			  <li>Select <strong>exactly four attributes</strong> that you consider strategically relevant.</li>
			  <li>The system will automatically generate <strong>six alternative direct maps</strong>, each based on a pair of attributes.</li>
			  <li>Explore how brand positions change depending on the selected dimensions.</li>
			  <li>Choose <strong>one map</strong> that best reflects your analytical perspective and add it to the Results.</li>
			</ol>
			<div style={{ marginTop: 8, fontStyle: 'italic', color: '#555' }}>
			  Different attribute choices lead to different interpretations. There is no single “correct” map — only justified ones.
			</div>
		  </>
		)}
	  </div>

	  <div
		style={{
		  display: 'grid',
		  gridTemplateColumns: '260px 1fr',
		  gap: 24,
		  alignItems: 'start',
		}}
	  >
		{/* LEFT — ATTRIBUTE SELECTION */}
		<div>
		  <h3>
			{project.lang === 'es'
			  ? 'Seleccione exactamente 4 atributos'
			  : 'Select exactly 4 attributes'}
		  </h3>

		  {attributes.map((a: any) => {
			if (!a) return null;
			const checked = selectedAttrIds.includes(a.id);
			const disabled = !checked && selectedAttrIds.length === 4;

			const label = project.lang === 'es' ? a.labelEs : a.labelEn;

			return (
			  <div key={a.id}>
				<label>
				  <input
					type="checkbox"
					checked={checked}
					disabled={disabled}
					onChange={() => toggleAttr(a.id)}
				  />{' '}
				  {label}
				</label>
			  </div>
			);
		  })}

		  <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
			{project.lang === 'es'
			  ? 'Cuatro atributos seleccionados generan seis mapas alternativos.'
			  : 'Four selected attributes generate six alternative maps.'}
		  </div>
		</div>

		{/* RIGHT — MAP */}
		<div>
		  <h3>
			{project.lang === 'es'
			  ? 'Mapas directos generados'
			  : 'Generated direct maps'}
		  </h3>

		  {!activePair && (
			<div style={{ color: '#777' }}>
			  {project.lang === 'es'
				? 'Seleccione 4 atributos para generar los mapas.'
				: 'Select 4 attributes to generate maps.'}
			</div>
		  )}

		  {pairs.length > 0 && (
			<>
			  {/* PAIR SELECTOR */}
			  <div
				style={{
				  display: 'flex',
				  flexWrap: 'wrap',
				  gap: 6,
				  marginBottom: 20,
				  justifyContent: 'center',
				  maxWidth: '100%',
				}}
			  >
				{pairs.map(([a, b]) => {
				  const isActive =
					activePair?.[0] === a && activePair?.[1] === b;

				  return (
					<button
					  key={`${a}-${b}`}
					  onClick={() => {
						setProject(prev => ({
						  ...prev,
						  directMapByAttributes: {
							selectedAttrIds,
							activePair: [a, b],
						  },
						}));
					  }}
					  style={{
						padding: '4px 10px',
						border: '1px solid #cfd8e3',
						borderRadius: 6,
						background: isActive ? '#0077c8' : '#fff',
						color: isActive ? '#fff' : '#111',
						fontSize: 13,
						fontWeight: isActive ? 500 : 400,
						cursor: 'pointer',
						transition: 'all 0.15s ease',
						whiteSpace: 'nowrap',
					  }}
					>
					  {attrLabel(a)} × {attrLabel(b)}
					</button>
				  );
				})}
			  </div>

			  {/* MAP AND ACTIONS CONTAINER */}
			  <div
				style={{
				  display: 'grid',
				  gridTemplateColumns: 'minmax(420px, 1fr) 300px',
				  gap: 24,
				  alignItems: 'start',
				}}
			  >
				{/* MAP CONTAINER - WITH WHITE BACKGROUND */}
				<div
				  style={{
					background: '#fff',
					border: '1px solid #dde6ee',
					borderRadius: 12,
					boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
					padding: 18,
				
					// ключевое: задаём понятную высоту области карты
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					minHeight: SVG_SIZE + 40,
				
					// важно: НЕ режем подписи
					overflow: 'visible',
				  }}
				>
				  <svg
					width={SVG_SIZE}
					height={SVG_SIZE}
					viewBox={`${-PAD} ${-PAD} ${SVG_SIZE + 2 * PAD} ${SVG_SIZE + 2 * PAD}`}
					style={{ overflow: 'visible' }}
				  >		
			  		{/* Y-axis label (left, centered) */}
					<text
					  x={PLOT_MIN - AXIS_LABEL_OFFSET}
					  y={PLOT_CENTER}
					  textAnchor="middle"
					  fontSize={AXIS_LABEL_FONT}
					  fill="#333"
					  fontWeight="600"
					  transform={`rotate(-90 ${PLOT_MIN - AXIS_LABEL_OFFSET} ${PLOT_CENTER})`}
					>
					  {yLabel}
					</text>
			  
					{/* X-axis label (bottom, centered) */}
					<text
					  x={PLOT_CENTER}
					  y={PLOT_MAX + AXIS_LABEL_OFFSET}
					  textAnchor="middle"
					  fontSize={AXIS_LABEL_FONT}
					  fill="#333"
					  fontWeight="600"
					>
					  {xLabel}
					</text>
			  
					{/* AXES */}
					<line 
					  x1={MARGIN} 
					  y1={MARGIN} 
					  x2={MARGIN} 
					  y2={SVG_SIZE - MARGIN} 
					  stroke="#111" 
					  strokeWidth="2" 
					/>
					<line 
					  x1={MARGIN} 
					  y1={SVG_SIZE - MARGIN} 
					  x2={SVG_SIZE - MARGIN} 
					  y2={SVG_SIZE - MARGIN} 
					  stroke="#111" 
					  strokeWidth="2" 
					/>
			  
					{/* POINTS */}
					{points.map((p, i) => {
					  const cx = MARGIN + p.x * PLOT_SIZE;
					  const cy = SVG_SIZE - (MARGIN + p.y * PLOT_SIZE);
			  
					  const labelDx = cx > SVG_SIZE / 2 ? -14 : 14;
					  const labelAnchor = cx > SVG_SIZE / 2 ? 'end' : 'start';
			  
					  const isHover = hoveredBrand === p.name;
			  
					  const r = p.isIdeal ? 9 : isHover ? 11 : 8;
					  const fill = p.isIdeal ? '#9ca3af' : '#0077c8';
					  const labelColor = p.isIdeal ? '#6b7280' : isHover ? '#000' : '#111';
			  
					  const dist = !p.isIdeal ? distanceToIdeal(p) : null;
			  
					  return (
						<g
						  key={i}
						  onMouseEnter={() => setHoveredBrand(p.name)}
						  onMouseLeave={() => setHoveredBrand(null)}
						  style={{ cursor: 'default' }}
						>
						  <circle cx={cx} cy={cy} r={r} fill={fill} />
			  
						  <text
							x={cx + labelDx}
							y={cy - 13}
							textAnchor={labelAnchor}
							fontSize="14px"
							fill={labelColor}
							fontWeight="400"
						  >
							{p.name}
						  </text>
			  
						  {isHover && !p.isIdeal && idealPoint && dist != null && (
							<text 
							  x={cx} 
							  y={cy + 35} 
							  textAnchor="middle" 
							  fontSize="12px" 
							  fill="#444" 
							  fontWeight="500"
							>
							  {project.lang === 'es'
								? `Distancia al IDEAL: ${dist.toFixed(2)}`
								: `Distance to IDEAL: ${dist.toFixed(2)}`}
							</text>
						  )}
						</g>
					  );
					})}
				  </svg>
				</div>

				{/* RIGHT COLUMN - INTERPRETATION AND BUTTON (NO BACKGROUND) */}
				<div
				  style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 24,
					justifyContent: 'flex-start',
					paddingTop: 20,
					width: 280,
					flexShrink: 0,
				  }}
				>
				  <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
					<strong style={{ fontSize: 19, display: 'block', marginBottom: 8 }}>
					  {project.lang === 'es' ? 'Interpretación' : 'Interpretation'}
					</strong>
					<p style={{ margin: 0 }}>
					  {project.lang === 'es'
						? 'La proximidad al punto IDEAL indica mayor adecuación estratégica.'
						: 'Proximity to the IDEAL point indicates stronger strategic fit.'}
					</p>
				  </div>
				
				  <button
					onClick={addToResults}
					disabled={!activePair || points.length === 0}
					style={{
					  padding: '14px 24px',
					  background: '#0077c8',
					  color: '#fff',
					  border: 'none',
					  borderRadius: 8,
					  fontSize: 16,
					  fontWeight: 600,
					  cursor: 'pointer',
					  whiteSpace: 'nowrap',
					  height: 'fit-content',
					  width: '100%',
					}}
				  >
					{project.lang === 'es' ? 'Añadir a resultados' : 'Add to Results'}
				  </button>
				</div>
			  </div>
			  
			  <div style={{ fontSize: 13, color: '#777', maxWidth: 900, margin: '0 auto', textAlign: 'left', marginTop: 8 }}>
				{project.lang === 'es'
				  ? 'Escala: 1–5 (inversiones de atributos ya aplicadas)'
				  : 'Scale: 1–5 (attribute reversals already applied)'}
			  </div>
			  
			  <div style={{ fontSize: 13, color: '#777', maxWidth: 900, margin: '0 auto', textAlign: 'left', marginTop: 8 }}>
			  {project.lang === 'es'
				? 'Este mapa muestra las posiciones de las marcas en un espacio de atributos seleccionado. Diferentes elecciones de atributos conducen a distintas interpretaciones estratégicas.'
				: 'This map shows brand positions in a selected attribute space. Different attribute choices lead to different strategic interpretations.'}
			  </div>
			</>
		  )}
		</div>
	  </div>
	</div>
  );
}