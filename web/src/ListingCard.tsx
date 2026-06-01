import { Listing } from "./types";

type Props = {
  listing: Listing;
  onHover?: (l: Listing | null) => void;
  onClick?: (l: Listing) => void;
};

function fmtPrice(n: number) {
  return "$" + n.toLocaleString();
}

export function ListingCard({ listing, onHover, onClick }: Props) {
  const acres = listing.lotAcres != null ? `${listing.lotAcres} ac` : null;
  const built =
    listing.yearBuilt && listing.yearBuilt > 0 ? `built ${listing.yearBuilt}` : null;
  const beds =
    listing.beds && listing.beds > 0 ? `${listing.beds} bd` : null;
  const baths =
    listing.baths && listing.baths > 0 ? `${listing.baths} ba` : null;

  return (
    <div
      className="card"
      onMouseEnter={() => onHover?.(listing)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => {
        onClick?.(listing);
        if (listing.url) window.open(listing.url, "_blank", "noopener");
      }}
    >
      <div className="price">{fmtPrice(listing.price)}</div>
      <div className="addr">
        {listing.address}, {listing.city}, {listing.state} {listing.zip}
      </div>
      <div className="meta-line">
        <span className="tag">{listing.isLand ? "Land" : "House"}</span>
        {acres && <span>{acres}</span>}
        {beds && <span>{beds}</span>}
        {baths && <span>{baths}</span>}
        {built && <span>{built}</span>}
      </div>
      <div className="meta-line">
        <span>
          🎿 {listing.skiName}: {listing.skiHours.toFixed(1)}h ({listing.skiMiles}mi)
        </span>
        <span>
          🏠 Ridgewood: {listing.ridgewoodHours.toFixed(1)}h ({listing.ridgewoodMiles}mi)
        </span>
      </div>
    </div>
  );
}
