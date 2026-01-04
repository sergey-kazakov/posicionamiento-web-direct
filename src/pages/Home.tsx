import React from 'react';
import { useApp } from '../store';
import { t } from '../i18n';

export function Home() {
  const { project } = useApp();
  const tr = t(project.lang);

  return (
	<div className="card">
	  <h2>{tr.homeTitle}</h2>

	  {/* Краткое описание возможностей, как у тебя было */}
	  <p>
		• {tr.map2d}
		{' '}• {tr.designer}
		{' '}• {tr.survey}
		{' '}• {tr.map2d}
		{' '}• {tr.directAttributesMap}
		{' '}• {tr.results} •
	  </p>

	  {/* Новая мини-инструкция с приветствием */}
	  <p style={{ whiteSpace: 'pre-line', marginTop: '1rem' }}>
		{tr.homeIntro}
	  </p>
	</div>
  );
}