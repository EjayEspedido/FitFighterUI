import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError(String(err));
    }
  };

  return (
    <div className="page auth-page">
      <h1 className="title">Fit Fighter</h1>
      <p className="tagline">Sign in to continue</p>
      <form className="auth-form" onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {error && <p className="auth-error">{error}</p>}
      </form>

      <p className="auth-switch">
        Don’t have an account?{" "}
        <span onClick={() => navigate("/signup")} className="auth-link">
          Sign up
        </span>
      </p>
    </div>
  );
}
