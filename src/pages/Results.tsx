// src/pages/Results.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { drawPerceptualMap } from '../utils/drawPerceptualMap';
import { t } from '../i18n';

type Props = {
  setView: (v: 'home' | 'designer' | 'survey' | 'map2d' | 'directmap' | 'results') => void;
};

export function Results({ setView }: Props) {
  const { project, setProject } = useApp();
  const tr = t(project.lang);
  const mapRef = useRef<HTMLCanvasElement | null>(null);
  const [studentName, setStudentName] = useState('');
  const [printMode, setPrintMode] = useState(false);

  const DIRECT_MAP_SIZE = 260;
  const DIRECT_MAP_PAD = 35;

  const prefMap = project.prefMap;

  /* =========================
     DRAW MDS MAP (CANVAS)
     ========================= */
  useEffect(() => {
    if (!prefMap) return;

    const canvas = mapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawPerceptualMap({
      ctx,
      canvas,
      project,
      prefMap,
      zoom: 1,
      hoverBrandIndex: null,
      showAttributes: true,
      selectedAttrIds: project.attributes.map((a: any) => a.id),
    });
  }, [prefMap, project.lang]); 
 
  /* =========================
     RESET RESPONSES
     ========================= */
  function resetResponses() {
    const msg =
      project.lang === 'es'
        ? '¿Reiniciar todas las respuestas?'
        : 'Reset all responses?';
  
    if (!window.confirm(msg)) return;
  
    setProject(prev => ({
      ...prev,
      responses: [],
      prefMap: undefined,
      results: [],
      directMapByAttributes: {
        selectedAttrIds: [],
        activePair: null,
      },
    }));
  }

  /* =========================
     DIRECT MAP (LAST SELECTED)
     ========================= */
  const directResults = project.results.filter(
    (r: any) => r.type === 'direct-attributes'
  );
  const lastDirect = directResults[directResults.length - 1];
  const [xAttrId, yAttrId] = lastDirect?.attributes ?? [];
  
  function attrLabel(id: string) {
    const a = project.attributes?.find((x: any) => x.id === id);
    if (!a) return id;
    return project.lang === 'es' ? a.labelEs : a.labelEn;
  }

  /* =========================
     RENDER
     ========================= */
  return (
    <div id="report-root" className="card">
      {!prefMap ? (
        /* ===== EMPTY STATE ===== */
        <div style={{ padding: 16 }}>
          <p>
            {project.lang === 'es'
              ? 'No hay resultados. Inicie un nuevo análisis.'
              : 'No results available. Please start a new analysis.'}
          </p>
      
          <button className="btn" onClick={() => setView('home')}>
            {project.lang === 'es' ? 'Volver al inicio' : 'Back to home'}
          </button>
        </div>
      ) : (
        /* ===== RESULTS CONTENT ===== */
        <div>
          {/* ===== HEADER (SCREEN) ===== */}
          <div
            className="print-hide"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            {/* LEFT: title + student name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 className="screen-title" style={{ margin: 0 }}>
                {project.lang === 'es'
                  ? 'Resultados del análisis de posicionamiento de marcas'
                  : 'Brands positioning analysis results'}
              </h3>
          
              <div
                className="student-name-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 220px",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <div>{tr.studentNameLabel}</div>
                <input
                  type="text"
                  className="student-name-input"
                  placeholder={tr.studentNamePlaceholder}
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </div>
            </div>
          
            {/* RIGHT: actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={resetResponses}>
                {project.lang === 'es'
                  ? 'Reiniciar respuestas'
                  : 'Reset responses'}
              </button>
          
              <button className="btn" onClick={() => window.print()}>
                PDF / Print
              </button>
            </div>
          </div>

          {/* ===== HEADER (PRINT) ===== */}
          <div
            className="print-only"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0 }}>
              {project.lang === 'es'
                ? 'Resultados del análisis de posicionamiento de marcas'
                : 'Brands positioning analysis results'}
            </h3>

            <div>              
              <div className="student-name-print">
                {tr.studentNameLabel}{' '}
                <span className="student-name-value">
                  {studentName || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ===== MDS MAP ===== */}
          <div style={{ marginBottom: 16 }}>
            <canvas
              ref={mapRef}
              width={900}
              height={350}
              style={{
                width: '100%',
                height: 'auto',
                aspectRatio: '900 / 350',
              }}
            />
          </div>

          {/* ===== RESULTS GRID ===== */}
          <div
            className="grid results-grid"
            style={{
              gridTemplateColumns: '260px 1fr 1fr',
              gap: 24,
              alignItems: 'start',
            }}
          >
            {/* === DIRECT MAP === */}
            <div>
              <h4>
                {project.lang === 'es'
                  ? 'Mapa directo seleccionado'
                  : 'Selected direct map'}
              </h4>

              {lastDirect ? (
                <>
                  <svg
                    width={DIRECT_MAP_SIZE}
                    height={DIRECT_MAP_SIZE}
                    viewBox={`-${DIRECT_MAP_PAD} -${DIRECT_MAP_PAD} ${
                      DIRECT_MAP_SIZE + DIRECT_MAP_PAD * 2
                    } ${DIRECT_MAP_SIZE + DIRECT_MAP_PAD * 2}`}
                  >
                    <line x1="0" y1="260" x2="300" y2="260" stroke="#000" />
                    <line x1="0" y1="0" x2="0" y2="260" stroke="#000" />

                    {lastDirect.points.map((p: any, i: number) => {
                      const x = p.x * DIRECT_MAP_SIZE;
                      const y = DIRECT_MAP_SIZE - p.y * DIRECT_MAP_SIZE;

                      return (
                        <g key={i}>
                          <circle
                            cx={x}
                            cy={y}
                            r={3.5}
                            fill={p.isIdeal ? '#999' : '#0d1b2a'}
                          />
                          <text
                            x={x + 6}
                            y={y - 4}
                            fontSize={9}
                            fill="#111"
                          >
                            {p.name}
                          </text>
                        </g>
                      );
                    })}
                    {/* X axis label */}
                    <text
                      x={DIRECT_MAP_SIZE / 2}
                      y={DIRECT_MAP_SIZE + 22}
                      textAnchor="middle"
                      fontSize={14}
                      fill="#111"
                    >
                      {attrLabel(xAttrId)}
                    </text>
                    
                    {/* Y axis label */}
                    <text
                      x={-22}
                      y={DIRECT_MAP_SIZE / 2}
                      textAnchor="middle"
                      fontSize={14}
                      fill="#111"
                      transform={`rotate(-90 -22 ${DIRECT_MAP_SIZE / 2})`}
                    >
                      {attrLabel(yAttrId)}
                    </text>
                  </svg>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#777' }}>
                  {project.lang === 'es'
                    ? 'No se ha seleccionado ningún mapa directo.'
                    : 'No direct map has been selected.'}
                </div>
              )}
            </div>

            {/* === PERFORMANCE MEANS === */}
            <div>
              <h4>
                {project.lang === 'es'
                  ? 'Medias de desempeño'
                  : 'Performance means'}
              </h4>

              <table>
                <thead>
                  <tr>
                    <th>{tr.brand}</th>
                    {project.attributes.map((a: any) => (
                      <th key={a.id}>
                        {project.lang === 'es' ? a.labelEs : a.labelEn}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prefMap.tables.performanceMeans.map((row: any, i: number) => (
                    <tr key={i}>
                      <td>{row.brand}</td>
                      {row.values.map((v: number, j: number) => (
                        <td key={j} className="num">
                          {v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* === SENSITIVITY + DISTANCES === */}
            <div>
              <h4>
                {project.lang === 'es'
                  ? 'Sensibilidad de atributos'
                  : 'Attribute sensitivity'}
              </h4>

              <table>
                <tbody>
                  {prefMap.tables.attributeSensitivity.map(
                    (row: any, i: number) => (
                      <tr key={i}>
                        <td>{row.attribute}</td>
                        <td className="num">
                          {row.magnitude.toFixed(2)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              <h4 style={{ marginTop: 16 }}>
                {project.lang === 'es'
                  ? 'Distancias a la marca IDEAL'
                  : 'Distances to IDEAL brand'}
              </h4>

              <table>
                <tbody>
                  {prefMap.tables.distancesToIdeal.map(
                    (row: any, i: number) => (
                      <tr key={i}>
                        <td>{row.brand}</td>
                        <td className="num">
                          {row.distance.toFixed(3)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}