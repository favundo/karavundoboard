import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAgencyInventory } from "@/hooks/useAgencyInventory";

// Approximate coordinates for known French agency cities
const CITY_COORDS: Record<string, [number, number]> = {
  "Albi": [43.93, 2.15],
  "Arcachon": [44.66, -1.17],
  "Aulnay-sous-bois": [48.94, 2.50],
  "Aurillac": [44.93, 2.44],
  "Auxerre": [47.80, 3.57],
  "Begles": [44.81, -0.55],
  "Bordeaux Meriadeck": [44.84, -0.58],
  "Bourges": [47.08, 2.40],
  "Brest": [48.39, -4.49],
  "Brestphare": [48.38, -4.48],
  "Bretigny": [48.61, 2.31],
  "Cergy": [49.04, 2.07],
  "Cesson Bois-senart": [48.61, 2.56],
  "Champfleury": [49.25, 4.03],
  "Claye Souilly": [48.94, 2.67],
  "Clermont-Ferrand": [45.78, 3.09],
  "Collegien Bay2": [48.83, 2.78],
  "Creil": [49.26, 2.48],
  "Creteil": [48.79, 2.46],
  "Dieppe": [49.92, 1.08],
  "Dijon": [47.32, 5.04],
  "Dreux": [48.74, 1.37],
  "Englos": [50.63, 2.97],
  "Epernay": [49.04, 3.96],
  "Evry2": [48.63, 2.43],
  "Farebersviller": [49.16, 6.88],
  "Flins": [48.97, 1.86],
  "Fontenay-sous-Bois": [48.85, 2.48],
  "Glissy": [49.52, 2.98],
  "Grenoble": [45.19, 5.72],
  "Herouville-saint-Clair": [49.21, -0.34],
  "La Defense": [48.89, 2.24],
  "Lanester": [47.77, -3.34],
  "Le Havre": [49.49, 0.11],
  "Le Mans": [48.00, 0.20],
  "Leers": [50.67, 3.27],
  "Lens": [50.43, 2.83],
  "Les Ulis": [48.68, 2.17],
  "Lieussaint Carre-Senart": [48.60, 2.57],
  "Lille Euralille": [50.63, 3.06],
  "Louvroil": [50.28, 3.97],
  "Lyon Part-Dieu": [45.76, 4.86],
  "Lyon Victor-Hugo": [45.75, 4.83],
  "Mandelieu-La-Napoule": [43.55, 6.94],
  "Marsac-Perigueux": [45.18, 0.72],
  "Marseille Grand Littoral": [43.33, 5.33],
  "Marseille TDP": [43.30, 5.38],
  "Maurepas": [48.75, 1.89],
  "Meaux": [48.96, 2.89],
  "Montesson": [48.91, 2.15],
  "Nancy": [48.69, 6.18],
  "Nantes Cassard": [47.22, -1.55],
  "Noisy": [48.84, 2.55],
  "Orange": [44.14, 4.81],
  "Orleans": [47.90, 1.90],
  "Orvault": [47.28, -1.62],
  "Paris Bonne-Nouvelle": [48.87, 2.35],
  "Paris Chaussee Antin": [48.87, 2.34],
  "Paris Sebastopol": [48.86, 2.35],
  "Paris Voltaire": [48.85, 2.38],
  "PERPIGNAN": [42.70, 2.90],
  "Plaisir": [48.83, 1.95],
  "Poitiers": [46.58, 0.34],
  "Quimper": [48.00, -4.10],
  "Rennes": [48.11, -1.68],
  "Roissy": [49.01, 2.52],
  "Roncq": [50.73, 3.14],
  "Rosny2": [48.87, 2.49],
  "Rouen": [49.44, 1.10],
  "Saint-Avold": [49.10, 6.71],
  "Saint-Etienne Centre2": [45.44, 4.39],
  "Saint-Genis": [45.77, 4.71],
  "Saint-Gregoire": [48.16, -1.69],
  "Saint-Laurent-du-Var": [43.67, 7.19],
  "Saint-Martin-Boulogne": [50.73, 1.61],
  "Saint-Orens": [43.54, 1.53],
  "Saint-Pierre-d-Irube": [43.49, -1.47],
  "Saint-Priest": [45.70, 4.95],
  "Saint-Quentin": [49.85, 3.29],
  "Soissons": [49.38, 3.32],
  "Thiais Belle-Epine": [48.77, 2.39],
  "Toulon": [43.12, 5.93],
  "Toulouse": [43.60, 1.44],
  "Tours": [47.39, 0.69],
  "Val d'europe": [48.87, 2.78],
  "Valenciennes": [50.36, 3.52],
  "Velizy": [48.78, 2.17],
  "Villeneuve-d-Asq": [50.61, 3.14],
  "Villeneuve-la-Garenne Qwartz": [48.94, 2.33],
  "Villiers-en-biere": [48.58, 2.64],
  "Vitrolles": [43.46, 5.25],
};

const normalizeAgence = (name: string): string => {
  // Try exact match first
  if (CITY_COORDS[name]) return name;
  // Try case-insensitive partial match
  const lower = name.toLowerCase();
  for (const key of Object.keys(CITY_COORDS)) {
    if (key.toLowerCase() === lower) return key;
    if (lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower.split(" ")[0])) return key;
  }
  return "";
};

const AgencyMap = () => {
  const { data, isLoading } = useAgencyInventory();
  const items = data ?? [];

  // Group items by agence and count
  const agencePoints = useMemo(() => {
    const counts = items.reduce<Record<string, number>>((acc, item) => {
      if (item.agence) acc[item.agence] = (acc[item.agence] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([agence, count]) => {
        const key = normalizeAgence(agence);
        const coords = CITY_COORDS[key];
        return coords ? { agence, count, lat: coords[0], lng: coords[1] } : null;
      })
      .filter(Boolean) as { agence: string; count: number; lat: number; lng: number }[];
  }, [items]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Carte des agences
        </h3>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {isLoading ? "…" : `${agencePoints.length} agences`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex h-96 items-center justify-center text-xs text-muted-foreground">
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-96 items-center justify-center text-xs text-muted-foreground">
          Importez un fichier pour afficher la carte.
        </div>
      ) : (
        <div className="h-96 w-full overflow-hidden rounded-lg border border-border">
          <MapContainer
            center={[46.5, 2.5]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {agencePoints.map((point) => (
              <CircleMarker
                key={point.agence}
                center={[point.lat, point.lng]}
                radius={7}
                pathOptions={{
                  fillColor: "hsl(215 100% 60%)",
                  fillOpacity: 0.85,
                  color: "hsl(215 100% 40%)",
                  weight: 1.5,
                }}
              >
                <Tooltip permanent={false} direction="top" offset={[0, -8]}>
                  <div className="text-xs font-medium">
                    <span className="font-semibold">{point.agence}</span>
                    <br />
                    {point.count} équipement{point.count > 1 ? "s" : ""}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default AgencyMap;
