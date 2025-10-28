import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Submitting sign-up..."); // sanity check
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Auth success:", userCredential.user.uid);

      await setDoc(doc(db, "users", userCredential.user.uid), {
        username,
        email,
        level,
        weight: Number(weight),
        height: Number(height),
        age: Number(age),
        createdAt: new Date(),
      });
      console.log("Firestore doc created");
      navigate("/");
    } catch (err) {
      console.error("Sign-up error:", err);
      if (err instanceof Error) setError(err.message);
      else setError(String(err));
    }
  };

  return (
    <div className="page auth-page">
      <h1 className="title">Fit Fighter</h1>
      <p className="tagline">Create your account</p>
      <form className="auth-form" onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (6+ chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="auth-select"
          required
        >
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
          <option>Expert</option>
        </select>
        <input
          type="number"
          placeholder="Current Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Current Height (cm)"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
        />
        <button type="submit">Sign Up</button>
        {error && <p className="auth-error">{error}</p>}
      </form>

      <p className="auth-switch">
        Already have an account?{" "}
        <span onClick={() => navigate("/login")} className="auth-link">
          Log in
        </span>
      </p>
    </div>
  );
}
