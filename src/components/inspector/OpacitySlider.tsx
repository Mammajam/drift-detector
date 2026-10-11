import styles from "./OpacitySlider.module.css";

type OpacitySliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
};

export function OpacitySlider({ value, onChange, disabled }: OpacitySliderProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.design}>Figma</span>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={disabled}
          aria-label="Live build opacity"
          aria-valuetext={`${value}% live build`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className={styles.build}>Live build</span>
        <output className={styles.value}>{value}%</output>
      </div>
      {disabled ? <p className={styles.hint}>Opacity applies in Overlay mode.</p> : null}
    </div>
  );
}
