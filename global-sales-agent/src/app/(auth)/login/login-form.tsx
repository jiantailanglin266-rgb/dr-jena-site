"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function LoginForm({ labels, demo }: { labels: Record<string, string>; demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(demo ? "admin@demo.local" : "");
  const [password, setPassword] = useState(demo ? "Demo1234!" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError(labels.error);
      return;
    }
    router.push(params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={labels.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required data-testid="login-email" />
        </Field>
        <Field label={labels.password}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required data-testid="login-password" />
        </Field>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full" data-testid="login-submit">{labels.submit}</Button>
        {demo ? <p className="text-center text-[11px] text-muted-foreground">{labels.demoHint}</p> : null}
      </form>
    </Card>
  );
}
