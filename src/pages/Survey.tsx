// src/pages/Survey.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { t } from '../i18n';
import { parseGoogleFormCSVToResponses } from "../utils/parseGoogleFormCSV";
import SurveyQRCode from "../components/SurveyQRCode";

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
  const [surveyUrlInput, setSurveyUrlInput] = useState("");
  
  // ----- CSV import --------
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvImported, setCsvImported] = useState(false);
    
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

  const prefQuestion =
    project.lang === 'es'
      ? 'En general, ¿hasta qué punto preferirías esta marca? (1–5)'
      : 'Overall, how much would you prefer this brand? (1–5)';

  const exportJSON = () => {
    const sandboxResponse = {
      performance: perf,
      preference: pref,
      importance: {},
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
  
  const applySurveyQR = () => {
    if (!surveyUrlInput.trim()) {
      alert(project.lang === "es"
        ? "Inserta la URL del formulario"
        : "Please insert the form URL");
      return;
    }
  
    setProject(prev => ({
      ...prev,
      surveySession: {
        url: surveyUrlInput.trim(),
      },
    }));
  };
  
  const applyToMap = () => {
    if (stagedResponses && stagedResponses.length) {
      const normalized = stagedResponses.map((r) => ({
        ...r,
        importance: r.importance ?? {},   // ← ГАРАНТИЯ ТИПА
      }));
  
      setProject((prev) => ({
        ...prev,
        responses: normalized,
      }));
    } else {
      const sandboxResponse = {
        performance: perf,
        preference: pref,
        importance: {},   // ← ОБЯЗАТЕЛЬНО
        ts: Date.now(),
      };
  
      setProject((prev) => ({
        ...prev,
        responses: [sandboxResponse],
      }));
  
      setDataSource("manual");
    }
  
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
    
      {/* --- MAIN LAYOUT WRAPPER --- */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingRight: 16,
        }}
      >
        {/* --- MAIN LAYOUT --- */}
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
            marginTop: 16,
          }}
        >
        
        {/* Блок performance + preference */}
        
        <div style={{ flex: 1, minWidth: 0 }}>
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
        
        {/* --- RIGHT COLUMN --- */}
        <div style={{ width: 469 }}>
        
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
                    ? "Datos importados. Pulsa «Aplicar al mapa» para generar los mapas. La edición manual está desactivada. El reset se realiza en la página de resultados."
                    : "Imported data. Click “Apply to map” to generate maps. Manual editing is disabled. Reset is available on the Results page.")
                : (project.lang === "es"
                    ? "Modo sandbox: los valores pueden editarse manualmente. Haz clic en «Aplicar al mapa» para generar los mapas."
                    : "Sandbox mode: values can be edited manually. Click on “Apply to map” to generate the maps.")}
            </div>
          </div>
        
          {/* --- SURVEY QR SETUP (INSTRUCTOR) --- */}
          <div className="card" style={{ marginBottom: 12 }}>
            <strong>
              {project.lang === "es"
                ? "QR del cuestionario (profesorado)"
                : "Survey QR (instructors)"}
            </strong>
            
            <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              {project.lang === "es"
                ? "Abra la plantilla del formulario, guárdela en su Google Drive, realice los cambios necesarios y pegue aquí el enlace de su encuesta."
                : "Open the form template, save it to your Google Drive, edit it as needed, and paste the survey link below."}
            </p>
          
            <div style={{ fontSize: 13, marginTop: 8 }}>
              <input
                type="text"
                placeholder={
                  project.lang === "es"
                    ? "Pega aquí la URL de tu Google Form"
                    : "Paste your Google Form URL here"
                }
                value={surveyUrlInput}
                onChange={(e) => setSurveyUrlInput(e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />
          
              <button className="btn btn-soft" onClick={applySurveyQR}>
                {project.lang === "es" ? "Actualizar QR" : "Update QR"}
              </button>
            </div>
          </div>
          
          {/* --- SURVEY QR CODE (STUDENTS) --- */}
          <div className="card" style={{ textAlign: "center" }}>
            <SurveyQRCode
              lang={project.lang}
              url={project.surveySession?.url}
            />
          </div>
          
          {/* --- JSON IMPORT / EXPORT INFO --- */}
          <div className="card" style={{ marginTop: 12 }}>
            <strong>
              {project.lang === "es"
                ? "Exportar / Importar JSON"
                : "Export / Import JSON"}
            </strong>
          
            <div style={{ fontSize: 13, marginTop: 6, color: "#555" }}>
              {project.lang === "es" ? (
                <>
                  <p style={{ margin: 0 }}>
                    El archivo JSON sirve para guardar y restaurar el estado del ejercicio
                    (modo sandbox o resultados agregados).
                  </p>
                  <p style={{ margin: "6px 0 0 0" }}>
                    No contiene respuestas individuales de los estudiantes y no sustituye
                    al archivo CSV del cuestionario.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0 }}>
                    The JSON file is used to save and restore the exercise state
                    (sandbox mode or aggregated results).
                  </p>
                  <p style={{ margin: "6px 0 0 0" }}>
                    It does not contain individual student responses and does not replace
                    the survey CSV file.
                  </p>
                </>
              )}
            </div>
          </div>        
        </div>       
      </div>
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