import { normalizeToPositiveQuadrant } from '../lib/positioningMath';

type SemanticPcaMapProps = {
  brandCoords: number[][];
  brandLabels: string[];
};

export function SemanticPcaMap(
  { brandCoords, brandLabels }: SemanticPcaMapProps
) {
  const coordsPositive = normalizeToPositiveQuadrant(brandCoords);

  return (
	<svg width={300} height={300}>
	  {coordsPositive.map(([x, y], i) => (
		<g key={i}>
		  <circle cx={x * 200 + 20} cy={y * 200 + 20} r={4} />
		  <text x={x * 200 + 26} y={y * 200 + 16} fontSize={10}>
			{brandLabels[i]}
		  </text>
		</g>
	  ))}
	</svg>
  );
}