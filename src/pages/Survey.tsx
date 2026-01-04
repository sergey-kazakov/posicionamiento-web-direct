// src/pages/Survey.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { t } from '../i18n';
/* import QRCode from 'qrcode.react'; */
{/* import { fbInit, fbPushResponse } from '../utils/firebase'; */}

type PerfState = Record<string, Record<string, number>>; // brand -> attrId -> 1..5
type PrefState = Record<string, number>;                  // brand -> 1..5

export function Survey() {
  const { project, setProject } = useApp();
  const tr = t(project.lang);

  // ---- ключ черновика (на основе id проекта) ----
  const DRAFT_KEY = `posi_draft_${project.id}`;

  // ---- вспомогательные генераторы пустых структур ----
  const makeEmptyPerf = (): PerfState => {
    const perf: PerfState = {};
    for (const b of project.brands) perf[b.name] = {};
    return perf;
  };

  const makeEmptyPref = (): PrefState => {
    const pref: PrefState = {};
    for (const b of project.brands) pref[b.name] = 3; // нейтрально по умолчанию
    return pref;
  };

  // ---- инициализация performance (с восстановлением черновика) ----
  const [perf, setPerf] = useState<PerfState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.performance) return parsed.performance as PerfState;
      }
    } catch {}
    return makeEmptyPerf();
  });

  // ---- инициализация preference (с восстановлением черновика) ----
  const [pref, setPref] = useState<PrefState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.preference) return parsed.preference as PrefState;
      }
    } catch {}
    return makeEmptyPref();
  });
  
  // ---- режим источника данных ----
  const [dataSource, setDataSource] = useState<"manual" | "imported">("manual");
  const hasImportedData = dataSource === "imported";
  
  {/*
  // ---- подготовка Firebase (если сконфигурирован) ----
  useEffect(() => {
    fbInit();
  }, []); */}

  // ---- автосохранение черновика (perf + pref) ----
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          performance: perf,
          preference: pref,
          ts: Date.now(),
        })
      );
    }, 250);
    return () => clearTimeout(id);
  }, [perf, pref]);

  // ---- URL для QR ----
  // URL для QR (используется, когда QR включён)
  const shareUrl = useMemo(
    () => window.location.origin + window.location.pathname + '#/survey',
    []
  );

  // ---- обновление отдельных значений ----
  const setPerfValue = (brand: string, attrId: string, v: number) => {
    setPerf((prev) => ({
      ...prev,
      [brand]: { ...(prev[brand] || {}), [attrId]: v },
    }));
  };

  const setPrefValue = (brand: string, v: number) => {
    setPref((prev) => ({
      ...prev,
      [brand]: v,
    }));
  };

  /*
  const submit = async () => {
    const response = {
      importance: {},
      performance: perf,
      preference: pref,
      ts: Date.now(),
    };
  
    const ok = await fbPushResponse(project.id, response);
    if (!ok) {
      setProject({
        ...project,
        responses: [...project.responses, response],
      });
    }
  
    localStorage.removeItem(DRAFT_KEY);
    alert('¡Gracias! / Thank you!');
    setPerf(makeEmptyPerf());
    setPref(makeEmptyPref());
  };
  */

  const prefQuestion =
    project.lang === 'es'
      ? 'En general, ¿hasta qué punto preferirías esta marca? (1–5)'
      : 'Overall, how much would you prefer this brand? (1–5)';

  return (
    <div className="card">
      <h3>{tr.survey}</h3>

      <div className="grid">
        {/* Блок performance + preference */}
        <div>
          <h4>{tr.performance}</h4>
          {project.brands.map((b) => (
            <div key={b.name} style={{ marginBottom: 18 }}>
              <strong>{b.name}</strong>

              {/* PERFORMANCE по атрибутам */}
              {project.attributes.map((a) => {
                const v = perf[b.name]?.[a.id] ?? 3; // визуально старт в 3
                return (
                  <div
                    key={a.id}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}
                  >
                    <small style={{ width: 220 }}>
                      {project.lang === 'es' ? a.labelEs : a.labelEn}
                    </small>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={v}
                      onChange={(e) => setPerfValue(b.name, a.id, parseInt(e.target.value))}
                    />
                    <span style={{ width: 18, textAlign: 'center' }}>{v}</span>
                  </div>
                );
              })}

              {/* PREFERENCE (общая привлекательность бренда) */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginTop: 8,
                  paddingTop: 6,
                  borderTop: '1px dashed #ddd',
                }}
              >
                <small style={{ width: 220 }}>{prefQuestion}</small>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={pref[b.name] ?? 3}
                  onChange={(e) => setPrefValue(b.name, parseInt(e.target.value))}
                />
                <span style={{ width: 18, textAlign: 'center' }}>{pref[b.name] ?? 3}</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* --- DATA STATUS --- */}
        <div className="card" style={{ marginBottom: 12 }}>
          <strong>
            {project.lang === "es"
              ? "Estado de los datos"
              : "Data status"}
          </strong>
        
          <div style={{ fontSize: 13, marginTop: 6, color: "#555" }}>
            {hasImportedData
              ? (project.lang === "es"
                  ? "Datos importados. La edición manual está desactivada."
                  : "Imported data. Manual editing is disabled.")
              : (project.lang === "es"
                  ? "Modo sandbox: los valores pueden editarse manualmente."
                  : "Sandbox mode: values can be edited manually.")}
          </div>
        </div>

        {/* QR (пока выключен) */}
        {/* {false && (
          <div>
            <div className="card" style={{ display: 'inline-block' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>QR</div>
              {false && <QRCode value={shareUrl} size={140} />}
              <div style={{ fontSize: 12, maxWidth: 220, wordBreak: 'break-all' }}>
                {shareUrl}
              </div>
            </div>
          </div>
        )} */}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        {/* <button className="btn" onClick={submit}>
          {tr.submit}
        </button> */}
      </div>
    </div>
  );
}