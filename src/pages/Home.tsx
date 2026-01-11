import React from 'react';
import { useApp } from '../store';
import { t } from '../i18n';

export function Home() {
  const { project } = useApp();
  const tr = t(project.lang);
  
  const manualUrl =
	project.lang === 'es'
	  ? 'https://uah-marketing-lab-docs.netlify.app/assets/files/manual-posicionamiento-es-3c9c96a04c5730e52f87f6ee8cd08fa0.pdf'
	  : 'https://uah-marketing-lab-docs.netlify.app/assets/files/manual-posicionamiento-en-b89472bb13b04b55d334f54b4c01cddf.pdf';

  return (
	<div className="card">
	  <h3>{tr.homeTitle}</h3>

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
	  
	  <p style={{ marginTop: '0.75rem' }}>
		{tr.homeManualText}{' '}
		<a
		  href={manualUrl}
		  target="_blank"
		  rel="noopener noreferrer"
		>
		  {tr.homeManualLink}
		</a>
		.
	  </p>
	</div>
  );
}