import React, { useEffect } from "react";

interface PadVisualizerProps {
  sequence: number[];
  activeIndex: number;
  onAdvance: () => void;
}

// Physical layout format
const padLayout = [
  [1, 2, 3],
  [4, 5, 6],
  [7, null, 8],
];

const PadVisualizer: React.FC<PadVisualizerProps> = ({
  sequence,
  activeIndex,
  onAdvance,
}) => {
  const activePad = sequence[activeIndex];

  // keyboard control
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") onAdvance();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, sequence]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pad grid */}
      <div className="flex flex-col gap-4">
        {padLayout.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-4">
            {row.map((pad, cIdx) =>
              pad ? (
                <div
                  key={cIdx}
                  className={`w-24 h-24 rounded-2xl border-4 flex items-center justify-center text-2xl font-bold transition-all duration-200 
                    ${
                      pad === activePad
                        ? "bg-green-400 border-green-500 text-black shadow-[0_0_25px_#00ff88] scale-105"
                        : "bg-gray-800 border-gray-600 text-white opacity-80"
                    }`}
                >
                  {pad}
                </div>
              ) : (
                <div key={cIdx} className="w-24 h-24" /> // empty slot
              )
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <button
        onClick={onAdvance}
        className="mt-6 px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-all"
      >
        Next
      </button>
    </div>
  );
};

export default PadVisualizer;
