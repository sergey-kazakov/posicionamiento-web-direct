// src/pages/Designer.tsx
import React, { useState } from 'react';
import { useApp, Attribute, BrandStyle } from '../store';
import { t } from '../i18n';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Универсальный элемент для сортировки (бренды / атрибуты)
type SortableItemProps = {
  id: string;
  children: React.ReactNode;
};

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
	useSortable({ id });

  const style: React.CSSProperties = {
	transform: CSS.Transform.toString(transform),
	transition,
	cursor: 'grab',
  };

  return (
	<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
	  {children}
	</div>
  );
}

export function Designer() {
  const { project, setProject } = useApp();
  const tr = t(project.lang);

  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('#0D1B2A');

  const [attrEs, setAttrEs] = useState('');
  const [attrEn, setAttrEn] = useState('');
  const [rev, setRev] = useState(false);
  const [attrError, setAttrError] = useState<string>('');

  // сенсоры для DnD (минимальное движение, чтобы не срабатывало от клика)
  const sensors = useSensors(
	useSensor(PointerSensor, {
	  activationConstraint: {
		distance: 5,
	  },
	})
  );

  // ───────── БРЕНДЫ ─────────

  function addBrand() {
	if (!brand.trim()) return;

	const b: BrandStyle = {
	  name: brand.trim(),
	  color,
	};

	setProject((prev) => ({
	  ...prev,
	  brands: [...prev.brands, b],
	}));

	setBrand('');
  }

  function delBrand(name: string) {
	const newBrands = project.brands.filter((b) => b.name !== name);
	const newBenchmark = project.benchmark === name ? '' : project.benchmark;

	setProject((prev) => ({
	  ...prev,
	  brands: prev.brands.filter((b) => b.name !== name),
	  benchmark: prev.benchmark === name ? '' : prev.benchmark,
	}));
  }

  function handleBrandsDragEnd(event: DragEndEvent) {
	const { active, over } = event;
	if (!over || active.id === over.id) return;

	const oldIndex = project.brands.findIndex((b) => b.name === active.id);
	const newIndex = project.brands.findIndex((b) => b.name === over.id);
	if (oldIndex === -1 || newIndex === -1) return;

	const reordered = arrayMove(project.brands, oldIndex, newIndex);

	setProject((prev) => ({
	  ...prev,
	  brands: reordered,
	}));
  }

  // ───────── АТРИБУТЫ ─────────

  function addAttr() {
	if (!attrEs.trim() || !attrEn.trim()) {
	  // текст ошибки из i18n — меняется с языком
	  setAttrError(tr.attrError);
	  return;
	}
	setAttrError('');

	const id =
	  attrEn.toLowerCase().replace(/[^a-z0-9]+/g, '_') +
	  '_' +
	  ((Math.random() * 1e4) | 0);

	const a: Attribute = {
	  id,
	  labelEs: attrEs,
	  labelEn: attrEn,
	  reversed: rev,
	};

	setProject((prev) => ({
	  ...prev,
	  attributes: [...prev.attributes, a],
	}));

	setAttrEs('');
	setAttrEn('');
	setRev(false);
  }

  function delAttr(id: string) {
	setProject({
	  ...project,
	  attributes: project.attributes.filter((a) => a.id !== id),
	});
  }

  function handleAttrsDragEnd(event: DragEndEvent) {
	const { active, over } = event;
	if (!over || active.id === over.id) return;

	const oldIndex = project.attributes.findIndex((a) => a.id === active.id);
	const newIndex = project.attributes.findIndex((a) => a.id === over.id);
	if (oldIndex === -1 || newIndex === -1) return;

	const reordered = arrayMove(project.attributes, oldIndex, newIndex);

	setProject((prev) => ({
	  ...prev,
	  attributes: reordered,
	}));
  }

  // ───────── РЕНДЕР ─────────

  return (
	<div className="card">
	  <div className="grid">
		
		{/* Продукт */}
		<div>
		  <h3>{tr.product}</h3>
		
		  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
			<div>
			  <label>ES</label>
			  <input
				value={project.product?.es || ''}
				placeholder="Ej. Zumos"
				onChange={(e) =>
				  setProject((prev) => ({
					...prev,
					product: {
					  ...(prev.product || { es: '', en: '' }),
					  es: e.target.value,
					},
				  }))
				}
			  />
			</div>
		
			<div>
			  <label>EN</label>
			  <input
				value={project.product?.en || ''}
				placeholder="E.g. Juices"
				onChange={(e) =>
				  setProject((prev) => ({
					...prev,
					product: {
					  ...(prev.product || { es: '', en: '' }),
					  en: e.target.value,
					},
				  }))
				}
			  />
			</div>
		  </div>
		
		  <p className="hint" style={{ marginTop: 6 }}>
			{tr.productNote}
		  </p>
		</div>
		
		{/* Бренды */}
		<div>
		  <h3>{tr.brands}</h3>

		  <div
			style={{
			  display: 'grid',
			  gridTemplateColumns: '1fr auto auto',
			  gap: 8,
			  alignItems: 'center',
			  marginBottom: 8,
			}}
		  >
			<input
			  value={brand}
			  onChange={(e) => setBrand(e.target.value)}
			  placeholder={tr.name}
			/>
			<input
			  type="color"
			  value={color}
			  onChange={(e) => setColor(e.target.value)}
			/>
			<button className="btn" onClick={addBrand}>
			  {tr.add}
			</button>
		  </div>

		  {/* Сортируемый список брендов */}
		  <DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleBrandsDragEnd}
		  >
			<SortableContext
			  items={project.brands.map((b) => b.name)}
			  strategy={verticalListSortingStrategy}
			>
			  <div className="grid" style={{ marginTop: 4 }}>
				{project.brands.map((b) => (
				  <SortableItem key={b.name} id={b.name}>
					<span
					  className="badge"
					  style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 6,
					  }}
					>
					  <span
						style={{
						  width: 10,
						  height: 10,
						  borderRadius: '50%',
						  backgroundColor: b.color,
						  border: '1px solid #ccc',
						}}
					  />
					  <span style={{ fontSize: 12 }}>☰</span>
					  <span>{b.name}</span>
					  <button
						onClick={() => delBrand(b.name)}
						style={{ marginLeft: 6 }}
					  >
						×
					  </button>
					</span>
				  </SortableItem>
				))}
			  </div>
			</SortableContext>
		  </DndContext>

		  {/* Benchmark */}
		  <div style={{ marginTop: 8 }}>
			<label>{tr.benchmark}: </label>
			<select
			  value={project.benchmark || ''}
			  onChange={(e) =>
				setProject((prev) => ({
				  ...prev,
				  benchmark: e.target.value,
				}))
			  }
			  
			>
			  <option value=""></option>
			  {project.brands.map((b) => (
				<option key={b.name} value={b.name}>
				  {b.name}
				</option>
			  ))}
			</select>
		  </div>
		</div>		

		{/* Атрибуты */}
		<div>
		  <h3>{tr.attributes}</h3>

		  <div className="grid" style={{ alignItems: 'flex-end' }}>
			<div>
			  <label>ES</label>
			  <input
				value={attrEs}
				onChange={(e) => setAttrEs(e.target.value)}
				placeholder="Etiqueta"
			  />
			</div>

			<div>
			  <label>EN</label>
			  <input
				value={attrEn}
				onChange={(e) => setAttrEn(e.target.value)}
				placeholder="Label"
			  />
			</div>

			<div>
			  <label>{tr.reversed}</label>
			  <input
				type="checkbox"
				checked={rev}
				onChange={(e) => setRev(e.target.checked)}
			  />
			</div>

			<div>
			  <button className="btn" onClick={addAttr}>
				{tr.add}
			  </button>
			  {!!attrError && (
				<div
				  style={{
					color: '#c0392b',
					fontSize: 12,
					marginTop: 4,
				  }}
				>
				  {attrError}
				</div>
			  )}
			</div>
		  </div>

		  {/* Сортируемый список атрибутов */}
		  <DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleAttrsDragEnd}
		  >
			<SortableContext
			  items={project.attributes.map((a) => a.id)}
			  strategy={verticalListSortingStrategy}
			>
			  <div className="grid" style={{ marginTop: 8 }}>
				{project.attributes.map((a) => (
				  <SortableItem key={a.id} id={a.id}>
					<span className="badge">
					  {project.lang === 'es' ? a.labelEs : a.labelEn}
					  {a.reversed ? ' (rev)' : ''}
					  <button
						onClick={() => delAttr(a.id)}
						style={{ marginLeft: 6 }}
					  >
						×
					  </button>
					</span>
				  </SortableItem>
				))}
			  </div>
			</SortableContext>
		  </DndContext>

		  {/* Инструкция по атрибутам — из i18n, меняется по языку */}
		  <p className="hint" style={{ marginTop: 8 }}>
			{tr.attrNote}
		  </p>

		  {/* Примечание про цену (как было раньше, тоже через i18n) */}
		  <p className="hint">{tr.priceNote}</p>
		</div>
	  </div>
	</div>
  );
}