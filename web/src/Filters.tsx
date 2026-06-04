import { FilterState, PropertyType } from "./types";

const STATES = ["NY", "VT", "NH", "ME", "MA", "RI"];

type Props = {
  value: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
};

export function Filters({ value, onChange, onClear }: Props) {
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    onChange({ ...value, [key]: v });

  const toggleState = (s: string) => {
    const next = new Set(value.states);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    set("states", next);
  };

  return (
    <div className="filters">
      <div className="filters-header">
        <h2>Filters</h2>
        <button className="clear-btn" onClick={onClear} title="Remove all filter constraints">
          Clear all
        </button>
      </div>

      <div className="field">
        <label>Property type</label>
        <div className="toggle-row">
          {(["all", "house", "land"] as PropertyType[]).map((t) => (
            <button
              key={t}
              className={value.propertyType === t ? "active" : ""}
              onClick={() => set("propertyType", t)}
            >
              {t === "all" ? "Both" : t === "house" ? "House" : "Land"}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Price (USD)</label>
        <div className="range-input">
          <input
            type="number"
            value={value.priceMin}
            min={0}
            step={5000}
            onChange={(e) => set("priceMin", Number(e.target.value))}
          />
          <span>–</span>
          <input
            type="number"
            value={value.priceMax}
            min={0}
            step={5000}
            onChange={(e) => set("priceMax", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>Lot acres</label>
        <div className="range-input">
          <input
            type="number"
            value={value.acresMin}
            min={0}
            step={0.5}
            onChange={(e) => set("acresMin", Number(e.target.value))}
          />
          <span>–</span>
          <input
            type="number"
            value={value.acresMax}
            min={0}
            step={0.5}
            onChange={(e) => set("acresMax", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>Year built (houses only)</label>
        <div className="range-input">
          <input
            type="number"
            value={value.yearBuiltMin}
            min={1700}
            max={2100}
            onChange={(e) => set("yearBuiltMin", Number(e.target.value))}
          />
          <span>–</span>
          <input
            type="number"
            value={value.yearBuiltMax}
            min={1700}
            max={2100}
            onChange={(e) => set("yearBuiltMax", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>
          Max drive to ski: {value.skiHoursMax.toFixed(1)}h
        </label>
        <input
          type="range"
          min={0}
          max={8}
          step={0.25}
          value={value.skiHoursMax}
          onChange={(e) => set("skiHoursMax", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>
          Max drive to Ridgewood NY: {value.ridgewoodHoursMax.toFixed(1)}h
        </label>
        <input
          type="range"
          min={0}
          max={12}
          step={0.25}
          value={value.ridgewoodHoursMax}
          onChange={(e) => set("ridgewoodHoursMax", Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>States</label>
        <div className="state-checks">
          {STATES.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={value.states.has(s)}
                onChange={() => toggleState(s)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
