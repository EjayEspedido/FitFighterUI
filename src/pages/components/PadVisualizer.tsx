import React, { useEffect, useState } from "react";

interface PadVisualizerProps {
  sequence: number[]; // e.g. [1, 1, 3, 5]
  activeIndex?: number; // optional external control
  onAdvance?: () => void; // callback when next pad should light up
}

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
  const [current, setCurrent] = useState(0);

  // handle external index if provided
  const index = activeIndex ?? current;
  const activePad = sequence[index];

  const handleNext = () => {
    if (current < sequence.length - 1) {
      setCurrent((prev) => prev + 1);
      onAdvance?.();
    }
  };

  // keypress simulation: press space or enter to advance
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [current, sequence]);

  return (
    <div className="flex flex-col items-center gap-2">
      {padLayout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-2">
          {row.map((pad, colIndex) =>
            pad ? (
              <div
                key={colIndex}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold transition-all duration-200 ${
                  pad === activePad
                    ? "bg-green-500 shadow-[0_0_20px_#00ff88]"
                    : "bg-gray-700"
                }`}
              >
                {pad}
              </div>
            ) : (
              <div key={colIndex} className="w-16 h-16" />
            )
          )}
        </div>
      ))}

      <button
        onClick={handleNext}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
      >
        Next
      </button>
    </div>
  );
};

export default PadVisualizer;
