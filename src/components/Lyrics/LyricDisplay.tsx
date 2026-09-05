import { useEffect, useRef, useState } from 'react';

interface LyricDisplayProps {
  lyrics: string | null;
  synced: boolean;
  position: number;
}

interface LyricLine {
  line: string;
  time?: number;
}

function parseLyrics(text: string): LyricLine[] {
  // Check for synced format: [MM:SS.mm] line
  const lines = text.split('\n');
  const parsed: LyricLine[] = [];
  const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)\]/g;

  for (const raw of lines) {
    const matches = [...raw.matchAll(timeRegex)];
    if (matches.length > 0) {
      const lyricText = raw.replace(timeRegex, '').trim();
      for (const m of matches) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseFloat(m[2]);
        parsed.push({ line: lyricText, time: minutes * 60 + seconds });
      }
    } else {
      parsed.push({ line: raw });
    }
  }
  return parsed;
}

export default function LyricDisplay({ lyrics, synced, position }: LyricDisplayProps) {
  const [currentLine, setCurrentLine] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const lines = lyrics ? parseLyrics(lyrics) : [];

  useEffect(() => {
    if (synced && lines.length > 0) {
      const idx = lines.reduce((acc, l, i) => {
        if (l.time !== undefined && l.time <= position) return i;
        return acc;
      }, -1);
      setCurrentLine(idx);
    }
  }, [position, synced, lines]);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLine]);

  if (!lyrics) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center font-mono text-xs text-gray-600 leading-6">
          <div className="text-2xl mb-3 text-gray-700">♪</div>
          <div>no lyrics available</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-3">
        {lines.map((l, i) => (
          <div
            key={i}
            ref={i === currentLine ? activeRef : undefined}
            className={`font-mono text-sm leading-relaxed transition-colors duration-300 ${
              i === currentLine
                ? 'text-white'
                : 'text-gray-600'
            }`}
          >
            {l.line || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
}
