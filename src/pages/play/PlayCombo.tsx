import React, { useEffect, useState } from "react";
import PadVisualizer from "../components/PadVisualizer";

// Static sets (array of arrays)
const SETS: number[][] = [
  [1, 1, 3],
  [1, 3, 1],
  [1, 3, 2],
  [1, 3, 5],
  [2, 2, 3, 2, 3],
  [1, 4, 7, 6, 5],
  [1, 4, 7, 6, 5],
];

const PlayCombo: React.FC = () => {
  // Which set are we on? Which step inside that set?
  const [setIndex, setSetIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const currentSet = SETS[setIndex];

  const advance = () => {
    // inside the current set
    if (stepIndex < currentSet.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    // move to next set
    if (setIndex < SETS.length - 1) {
      setSetIndex((s) => s + 1);
      setStepIndex(0);
      return;
    }
    // finished all sets – optionally loop or stop
    // To loop from the beginning, uncomment next line:
    // setSetIndex(0); setStepIndex(0);
  };

  // Allow Space / Enter to advance from the page too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setIndex, stepIndex]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-2 text-green-400">Combo Mode</h1>
      <p className="text-sm text-gray-400 mb-6">
        Set {setIndex + 1} / {SETS.length} — Step {stepIndex + 1} /{" "}
        {currentSet.length}
      </p>

      {/* Reuse the visualizer by feeding it the current set as a sequence and the active index */}
      <PadVisualizer
        sequence={currentSet}
        activeIndex={stepIndex}
        onAdvance={advance}
      />

      <div className="mt-6 text-gray-400 text-center">
        <p>
          Press <b>Space</b> or <b>Enter</b>, or click <b>Next</b>.
        </p>
      </div>
    </div>
  );
};

export default PlayCombo;
