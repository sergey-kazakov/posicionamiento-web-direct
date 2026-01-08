// src/pages/Survey.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { t } from '../i18n';
import { parseGoogleFormCSVToResponses } from "../utils/parseGoogleFormCSV";
// import QRCode from 'qrcode.react';
// import { fbInit, fbPushResponse } from '../utils/firebase';

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
  const [stagedResponses, setStagedResponses] = useState<any[] | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  
  // ----- CSV import --------
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvImported, setCsvImported] = useState(false);
  
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

  const exportJSON = () => {
    const sandboxResponse = {
      performance: perf,
      preference: pref,
      ts: Date.now(),
    };
  
    const payload = {
      version: 2,
      responses: [sandboxResponse],
      meta: {
        projectId: project.id,
        brands: project.brands.map(b => b.name),
        attributes: project.attributes.map(a => a.id),
        exportedAt: Date.now(),
      },
    };
  
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
  
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey_responses_${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
  
        if (data.version !== 2 || !Array.isArray(data.responses)) {
          alert("Invalid JSON format (expected version 2)");
          return;
        }
  
        const responses = data.responses;
        setStagedResponses(responses);
        
        const { perf: perfMean, pref: prefMean } = aggregateResponses(responses);
        setPerf(perfMean);
        setPref(prefMean);
        
        setDataSource("imported");
        
        alert(project.lang === "es" ? "JSON importado. Pulsa «Aplicar al mapa»." : "JSON imported. Click “Apply to map”.");  
        
      } catch (err) {
        alert("Failed to read JSON file");
      }
    };
  
    reader.readAsText(file);
  };
  
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const responses = parseGoogleFormCSVToResponses(text, project);
  
        // 1) staged (ещё НЕ пишем в project.responses)
        setStagedResponses(responses);
  
        // 2) mean → в бегунки
        const { perf: perfMean, pref: prefMean } = aggregateResponses(responses);
        setPerf(perfMean);
        setPref(prefMean);
  
        // 3) режим imported (блокируем)
        setDataSource("imported");
        
        // сбросить value input, чтобы можно было импортить тот же файл снова
        e.target.value = "";
        alert(project.lang === "es" ? "CSV importado. Pulsa «Aplicar al mapa»." : "CSV imported. Click “Apply to map”.");
      } catch (err: any) {
        console.error(err);
        alert(
          project.lang === "es"
            ? `Error CSV: ${err?.message || "formato inválido"}`
            : `CSV error: ${err?.message || "invalid format"}`
        );
      }
    };
  
    reader.readAsText(file);
  };
  
  const applyToMap = () => {
    if (stagedResponses && stagedResponses.length) {
      setProject((prev) => ({
        ...prev,
        responses: stagedResponses,
      }));
    } else {
      const sandboxResponse = {
        performance: perf,
        preference: pref,
        ts: Date.now(),
      };
  
      setProject((prev) => ({
        ...prev,
        responses: [sandboxResponse],
      }));
  
      setDataSource("manual");
    }
  
    // ✅ MODAL ВСЕГДА ПОСЛЕ APPLY
    setShowApplyModal(true);
  };
  
  const aggregateResponses = (responses: any[]) => {
    const perfAgg: any = {};
    const prefAgg: any = {};
  
    if (!responses.length) {
      return { perf: makeEmptyPerf(), pref: makeEmptyPref() };
    }
  
    responses.forEach((r) => {
      Object.entries(r.performance || {}).forEach(([brand, attrs]: any) => {
        if (!perfAgg[brand]) perfAgg[brand] = {};
        Object.entries(attrs).forEach(([attrId, val]: any) => {
          if (!perfAgg[brand][attrId]) perfAgg[brand][attrId] = [];
          perfAgg[brand][attrId].push(val);
        });
      });
  
      Object.entries(r.preference || {}).forEach(([brand, val]: any) => {
        if (!prefAgg[brand]) prefAgg[brand] = [];
        prefAgg[brand].push(val);
      });
    });
  
    const perf: any = {};
    Object.entries(perfAgg).forEach(([brand, attrs]: any) => {
      perf[brand] = {};
      Object.entries(attrs).forEach(([attrId, vals]: any) => {
        perf[brand][attrId] =
          vals.reduce((s, x) => s + x, 0) / vals.length;
      });
    });
  
    const pref: any = {};
    Object.entries(prefAgg).forEach(([brand, vals]: any) => {
      pref[brand] =
        vals.reduce((s, x) => s + x, 0) / vals.length;
    });
  
    return { perf, pref };
  };
  
  function detectDelimiter(line: string) {
    const candidates = [",", ";", "\t"];
    let best = ",";
    let bestCount = -1;
    for (const d of candidates) {
      const c = line.split(d).length;
      if (c > bestCount) {
        bestCount = c;
        best = d;
      }
    }
    return best;
  }
  
  function splitCSVLine(line: string, delim: string) {
    // минимальный CSV splitter с учётом кавычек
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
  
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // двойные кавычки "" внутри строк
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out.map((s) => s.replace(/^"(.*)"$/, "$1").trim());
  }
  
  function normalizeHeader(h: string) {
    return h.trim().toLowerCase();
  }
  
  function clamp15(v: number) {
    if (v < 1) return 1;
    if (v > 5) return 5;
    return v;
  }
  
  function buildBrandMap(project: any) {
    const map = new Map<string, string>();
    for (const b of project.brands) {
      map.set(b.name.trim().toLowerCase(), b.name);
    }
    // небольшой бонус: IDEAL
    const ideal = project.brands.find((b: any) => /ideal/i.test(b.name));
    if (ideal) {
      map.set("ideal", ideal.name);
      map.set("marca ideal", ideal.name);
    }
    return map;
  }
  
  function buildAttrMap(project: any) {
    // маппим: id + labelEs + labelEn + "Atributo - N" по индексу
    const map = new Map<string, string>();
    project.attributes.forEach((a: any, idx: number) => {
      map.set(String(a.id).trim().toLowerCase(), a.id);
      if (a.labelEs) map.set(String(a.labelEs).trim().toLowerCase(), a.id);
      if (a.labelEn) map.set(String(a.labelEn).trim().toLowerCase(), a.id);
  
      // поддержка "Atributo - 1" / "Attribute - 1"
      map.set(`atributo - ${idx + 1}`, a.id);
      map.set(`attribute - ${idx + 1}`, a.id);
    });
    return map;
  }  
    
  function parseNormalizedCSVToResponses(text: string, project: any) {
    const linesRaw = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
  
    if (!linesRaw.length) {
      throw new Error("Empty CSV");
    }
  
    const delim = detectDelimiter(linesRaw[0]);
    const headers = splitCSVLine(linesRaw[0], delim).map(normalizeHeader);
  
    const idx = {
      respondent: headers.indexOf("respondent"),
      brand: headers.indexOf("brand"),
      attribute: headers.indexOf("attribute"),
      value: headers.indexOf("value"),
    };
  
    if (idx.respondent < 0 || idx.brand < 0 || idx.attribute < 0 || idx.value < 0) {
      throw new Error("CSV schema mismatch");
    }
  
    const brandMap = buildBrandMap(project);
    const attrMap = buildAttrMap(project);
  
    // respondent -> response
    const byResp = new Map<string, any>();
  
    for (let i = 1; i < linesRaw.length; i++) {
      const cols = splitCSVLine(linesRaw[i], delim);
      const respondent = (cols[idx.respondent] ?? "").trim();
      const brandRaw = (cols[idx.brand] ?? "").trim();
      const attrRaw = (cols[idx.attribute] ?? "").trim();
      const valRaw = (cols[idx.value] ?? "").trim();
  
      if (!respondent || !brandRaw || !attrRaw || !valRaw) continue;
  
      const brandKey = brandRaw.toLowerCase();
      const brand = brandMap.get(brandKey);
      if (!brand) {
        // неизвестный бренд → это ошибка контракта
        throw new Error(`Unknown brand: ${brandRaw}`);
      }
  
      const num = Number(valRaw);
      if (!Number.isFinite(num)) {
        throw new Error(`Non-numeric value at line ${i + 1}`);
      }
      const value = Math.min(5, Math.max(1, num));
  
      if (!byResp.has(respondent)) {
        byResp.set(respondent, {
          performance: {},
          preference: {},
          ts: Date.now(),
        });
      }
  
      const r = byResp.get(respondent);
  
      if (isPreferenceLabel(attrRaw)) {
        r.preference[brand] = value;
      } else {
        const attrKey = attrRaw.toLowerCase();
        const attrId = attrMap.get(attrKey);
        if (!attrId) {
          throw new Error(`Unknown attribute: ${attrRaw}`);
        }
        if (!r.performance[brand]) r.performance[brand] = {};
        r.performance[brand][attrId] = value;
      }
    }
  
    const responses = Array.from(byResp.values());
  
    if (!responses.length) {
      throw new Error("No valid rows found");
    }
  
    return responses;
  }
    
  return (
  <>
    {/* --- SURVEY HEADER / TOOLBAR --- */}
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        paddingRight: 16,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <h3 style={{ margin: 0 }}>{tr.survey}</h3>
    
        <div style={{ display: "flex", gap: 8 }}>
          
          {/* Import CSV */}
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            id="import-csv-input"
            onChange={handleImportCSV}
          />
    
          <button
            className="btn btn-soft"
            onClick={() => document.getElementById("import-csv-input")?.click()}
          >
            {project.lang === "es" ? "Importar CSV" : "Import CSV"}
          </button>
    
          <button
            className="btn btn-soft"
            onClick={applyToMap}
          >
            {project.lang === "es" ? "Aplicar al mapa" : "Apply to map"}
          </button>
    
          <button className="btn btn-soft" onClick={exportJSON}>
            {project.lang === "es" ? "Exportar JSON" : "Export JSON"}
          </button>
    
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            id="import-json-input"
            onChange={handleImportJSON}
          />
    
          <button
            className="btn btn-soft"
            onClick={() => document.getElementById("import-json-input")?.click()}
          >
            {project.lang === "es" ? "Importar JSON" : "Import JSON"}
          </button>
        </div>
      </div>
    </div>
    
      {/* --- MAIN LAYOUT (NO CSS) --- */}
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
          marginTop: 16,
        }}
      >
        {/* Блок performance + preference */}
        
        <div>
          <h4>{tr.performance}</h4>        
                    
          {project.brands.map((b) => (
            <div key={b.name} style={{ marginBottom: 18 }}>
              <strong>{b.name}</strong>

              {/* PERFORMANCE по атрибутам */}
              {project.attributes.map((a) => {
                const raw = perf[b.name]?.[a.id] ?? 3;
                const v = Number(raw.toFixed(1)); // для отображения
                const sliderValue = Math.round(raw); // только для range
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
                      value={sliderValue}
                      disabled={hasImportedData}
                      onChange={(e) => setPerfValue(b.name, a.id, parseInt(e.target.value, 10))}
                    />
                    
                    <span style={{ width: 32, textAlign: "right" }}>{v.toFixed(1)}</span>
                  </div>
                );
              })}

              {/* PREFERENCE (общая привлекательность бренда) */}
              {(() => {
                const rawPref = pref[b.name] ?? 3;
                const sliderPref = Math.round(rawPref);
                const labelPref = Number(rawPref).toFixed(1);
              
                return (
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
                      value={sliderPref}
                      disabled={hasImportedData}
                      onChange={(e) =>
                        setPrefValue(b.name, parseInt(e.target.value, 10))
                      }
                    />
              
                    <span style={{ width: 32, textAlign: 'right' }}>{labelPref}</span>
                  </div>
                );
              })()}
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
                  ? "Datos importados. Pulsa «Aplicar al mapa» para generar los mapas. La edición manual está desactivada. El reset se realiza en la página de resultados o despúes de ver el mapa de posicionamiento en la proxima pagina."
                  : "Imported data. Click “Apply to map” to generate maps. Manual editing is disabled. Reset is available on the Results page or after viewing the Positioning Map.")
              : (project.lang === "es"
                  ? "Modo sandbox: los valores pueden editarse manualmente. Haz clic en «Aplicar al mapa» para generar los mapas. El reset se realiza en la página de resultados."
                  : "Sandbox mode: values can be edited manually. Click on “Apply to map” to generate the maps. Reset is available on the Results page.")}
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
      
            {/* --- APPLY CONFIRMATION MODAL --- */}
                  {showApplyModal && (
                          <div
                            style={{
                              position: "fixed",
                              inset: 0,
                              background: "rgba(0,0,0,0.35)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 9999,
                            }}
                            onClick={() => setShowApplyModal(false)}
                          >
                            <div
                              className="card"
                              style={{ maxWidth: 420, padding: 20 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h4 style={{ marginTop: 0 }}>
                                {project.lang === "es"
                                  ? "Mapas actualizados"
                                  : "Maps updated"}
                              </h4>
                  
                              <p style={{ fontSize: 14, color: "#444" }}>
                                {project.lang === "es"
                                  ? "Los datos se han aplicado correctamente. Puedes continuar con el análisis de los mapas."
                                  : "The data has been applied successfully. You can now continue analyzing the maps."}
                              </p>
                  
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                                <button className="btn" onClick={() => setShowApplyModal(false)}>
                                  {project.lang === "es" ? "Aceptar" : "OK"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }