import { useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../state/AuthContext";
import { ownerEmail } from "../lib/supabase";
import { Button, Card } from "./primitives";

export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, loading, user, error, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!configured) return <>{children}</>;
  if (!ownerEmail) return <div className="auth-page"><Card><div className="h2">Owner sign-in is not configured.</div><div className="sub">Set VITE_OWNER_EMAIL in the deployment settings.</div></Card></div>;
  if (user) return <>{children}</>;
  if (loading) return <div className="auth-page"><Card><div className="h2">Checking your session...</div></Card></div>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    const result = await sendMagicLink(email);
    setMessage(result ?? "Check your email for the sign-in link.");
    if (!result) setEmail("");
    setSending(false);
  };

  return (
    <div className="auth-page">
      <Card style={{ maxWidth: 440, width: "100%" }}>
        <div className="h1">AI Engineer Roadmap</div>
        <div className="sub">Sign in to access your private progress from anywhere.</div>
        <form onSubmit={submit}>
          <label className="lbl" htmlFor="auth-email">Owner email</label>
          <input id="auth-email" className="input" type="email" value={email}
            onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          <Button variant="p" type="submit" disabled={sending} style={{ marginTop: 12 }}>
            {sending ? "Sending..." : "Email me a sign-in link"}
          </Button>
        </form>
        {message ? <div className="callout ok" style={{ marginTop: 12 }}>{message ?? "Check your email for the sign-in link."}</div> : null}
        {error ? <div className="callout bad" style={{ marginTop: 12 }}>{error}</div> : null}
      </Card>
    </div>
  );
}
