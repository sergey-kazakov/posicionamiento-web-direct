type Props = {
  lang: "es" | "en";
};

export default function SurveyQRCode({ lang }: Props) {
  const isEs = lang === "es";

  const imgSrc = isEs
	? "/qr/ES_qrcode_encuesta.png"
	: "/qr/EN_qrcode_survey.png";

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
		{isEs ? (
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
		)}
	  </div>
	</div>
  );
}