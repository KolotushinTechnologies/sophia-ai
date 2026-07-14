type Mood = 'idle' | 'thinking' | 'speaking';

export function SofiCharacter({ mood = 'idle' }: { mood?: Mood }) {
  return (
    <div className={`sofi-character ${mood}`} aria-hidden>
      <div className="sofi-figure">
        <div className="sofi-pigtail left" />
        <div className="sofi-pigtail right" />
        <div className="sofi-face">
          <span className="sofi-eye left" />
          <span className="sofi-eye right" />
          <span className="sofi-smile" />
        </div>
      </div>
    </div>
  );
}
