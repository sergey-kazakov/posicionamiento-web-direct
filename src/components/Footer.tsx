// src/components/Footer.tsx
import React from "react";
import { useApp } from "../store";
import { t } from '../i18n';

export default function Footer() {
  const { lang } = useApp();
  const tr = t(lang);

  return (
	<footer>
	  <div className="container footer-inner">
		{tr.footerText}
	  </div>
	</footer>
  );
}