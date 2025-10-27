// import React, { useEffect, useMemo, useState } from "react";

// export type Level = "Beginner" | "Intermediate" | "Advanced" | "Expert";

// interface StartScreenProps {
//   duration?: number; // (kept for backward compat but unused now)
//   heartRate?: number | null | undefined;
//   // New API: tell parent the chosen level & minutes
//   onStart: (opts: { level: Level; minutes: number }) => void;
//   onExit: () => void;
//   // Optional defaults
//   defaultLevel?: Level;
//   defaultMinutes?: number; // total workout minutes
// }

// const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

// const StartScreen: React.FC<StartScreenProps> = ({
//   heartRate,
//   onStart,
//   onExit,
//   defaultLevel = "Intermediate",
//   defaultMinutes = 10,
// }) => {
//   const [level, setLevel] = useState<Level>(defaultLevel);
//   const [minutes, setMinutes] = useState<number>(defaultMinutes);

//   const canStart = useMemo(() => minutes >= 1 && minutes <= 90, [minutes]);

//   return (
//     <div
//       style={{
//         width: "100%",
//         maxWidth: 720,
//         display: "grid",
//         gap: 16,
//         textAlign: "center",
//       }}
//     >
//       <h2 style={{ margin: 0, fontWeight: 900 }}>Get Ready</h2>

//       <div
//         style={{
//           display: "grid",
//           gridTemplateColumns: "1fr 1fr",
//           gap: 16,
//         }}
//       >
//         {/* Level picker */}
//         <div
//           style={{
//             border: "1px solid #1f2937",
//             borderRadius: 12,
//             padding: 16,
//             background: "#0b1220",
//             textAlign: "left",
//           }}
//         >
//           <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
//             Select Level
//           </div>
//           <div
//             style={{
//               display: "grid",
//               gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
//               gap: 8,
//             }}
//           >
//             {LEVELS.map((lv) => (
//               <button
//                 key={lv}
//                 onClick={() => setLevel(lv)}
//                 style={{
//                   padding: "10px 12px",
//                   borderRadius: 10,
//                   border:
//                     level === lv ? "2px solid #60a5fa" : "1px solid #1f2937",
//                   background: level === lv ? "#111827" : "#0b1220",
//                   fontWeight: 700,
//                   cursor: "pointer",
//                 }}
//               >
//                 {lv}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Time picker */}
//         <div
//           style={{
//             border: "1px solid #1f2937",
//             borderRadius: 12,
//             padding: 16,
//             background: "#0b1220",
//             textAlign: "left",
//           }}
//         >
//           <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
//             Workout Duration (minutes)
//           </div>

//           <div style={{ display: "grid", gap: 10 }}>
//             <input
//               type="range"
//               min={1}
//               max={90}
//               value={minutes}
//               onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
//             />
//             <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//               <input
//                 type="number"
//                 min={1}
//                 max={90}
//                 value={minutes}
//                 onChange={(e) =>
//                   setMinutes(
//                     Math.max(
//                       1,
//                       Math.min(90, parseInt(e.target.value || "1", 10))
//                     )
//                   )
//                 }
//                 style={{
//                   width: 90,
//                   padding: "8px 10px",
//                   borderRadius: 8,
//                   border: "1px solid #1f2937",
//                   background: "#030712",
//                   color: "#e5e7eb",
//                 }}
//               />
//               <span style={{ opacity: 0.7 }}>min</span>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* HR row */}
//       <div style={{ opacity: 0.85 }}>
//         <div style={{ fontSize: 12, opacity: 0.7 }}>Current Heart Rate</div>
//         <div style={{ fontWeight: 800, fontSize: 18 }}>
//           {heartRate ?? "—"} bpm
//         </div>
//       </div>

//       <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
//         <button
//           onClick={() => onStart({ level, minutes })}
//           disabled={!canStart}
//           style={{
//             padding: "12px 18px",
//             borderRadius: 10,
//             border: "1px solid #1f2937",
//             background: canStart ? "#111827" : "#0f172a",
//             color: canStart ? "#e5e7eb" : "#64748b",
//             fontWeight: 800,
//             cursor: canStart ? "pointer" : "not-allowed",
//           }}
//         >
//           Start Workout
//         </button>
//         <button
//           onClick={onExit}
//           style={{
//             padding: "12px 18px",
//             borderRadius: 10,
//             border: "1px solid #1f2937",
//             background: "#0b1220",
//             color: "#e5e7eb",
//             fontWeight: 700,
//             cursor: "pointer",
//           }}
//         >
//           Exit
//         </button>
//       </div>
//     </div>
//   );
// };

// export default StartScreen;
