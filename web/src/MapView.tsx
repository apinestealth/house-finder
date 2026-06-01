import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import { Listing, Resort } from "./types";

type Props = {
  listings: Listing[];
  resorts: Resort[];
};

function fmtPrice(n: number) {
  return "$" + n.toLocaleString();
}

export function MapView({ listings, resorts }: Props) {
  const center: [number, number] = [43.7, -72.5];

  return (
    <MapContainer center={center} zoom={7} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {resorts.map((r) => (
        <CircleMarker
          key={`ski-${r.name}`}
          center={[r.lat, r.lng]}
          radius={4}
          pathOptions={{ color: "#1f5aa6", fillColor: "#3b82f6", fillOpacity: 0.8, weight: 1 }}
        >
          <Popup>
            <div style={{ fontSize: 12 }}>
              <strong>{r.name}</strong>
              <br />
              {r.state}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {listings.map((l) => (
        <Marker key={`${l.url}-${l.lat}-${l.lng}`} position={[l.lat, l.lng]}>
          <Popup>
            <div className="popup-card">
              <div className="price">{fmtPrice(l.price)}</div>
              <div>
                {l.address}
                <br />
                {l.city}, {l.state}
              </div>
              <div style={{ marginTop: 4 }}>
                {l.isLand ? "Land" : "House"}
                {l.lotAcres != null && ` · ${l.lotAcres} ac`}
                {l.yearBuilt ? ` · built ${l.yearBuilt}` : ""}
              </div>
              <div style={{ marginTop: 4 }}>
                🎿 {l.skiName}: {l.skiHours.toFixed(1)}h
                <br />
                🏠 Ridgewood: {l.ridgewoodHours.toFixed(1)}h
              </div>
              {l.url && (
                <div style={{ marginTop: 6 }}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    View on Redfin →
                  </a>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
