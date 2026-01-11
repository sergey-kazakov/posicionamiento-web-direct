export default function SurveyQRCode({
  lang,
  url,
}: {
  lang: string;
  url?: string;
}) {
	const isEs = lang === "es";
	
	  const finalUrl =
		url ?? "https://forms.gle/DEMO_TEMPLATE_URL";
	
	  const imgSrc =
		"https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=" +
		encodeURIComponent(finalUrl);

  return (
	<div
	  style={{
		textAlign: "center",
		marginTop: 16,
	  }}
	>
	  <img
		src={imgSrc}
		alt="Survey QR"
		style={{
		  width: 480,
		  maxWidth: "100%",
		  marginBottom: 12,
		}}
	  />

	  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.4 }}>
		{url ? (
		  isEs ? (
			<>
			  Escanee este código QR con su teléfono móvil para acceder a la
			  encuesta.  
			  <br />
			  Complete la encuesta y vuelva a esta página.
			</>
		  ) : (
			<>
			  Scan this QR code with your mobile phone to access the survey.  
			  <br />
			  Complete the survey and return to this page.
			</>
		  )
		) : (
		  isEs ? (
			<>
			  QR de ejemplo (plantilla).  
			  <br />
			  El profesor debe usar su propia copia del formulario.
			</>
		  ) : (
			<>
			  Example QR (template).  
			  <br />
			  The instructor must use their own form copy.
			</>
		  )
		)}
	  </div>
	</div>
  );
}