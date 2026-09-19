import { CreditCard, Receipt, Mail, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspaces } from "../context/WorkspaceContext.jsx";

// Account-level settings. Billing is the only section for now; LOFT has no
// payment backend yet, so everything here is either derived from data the
// app already has (workspaces, members, email) or an honest empty state.

function SectionHeading({ title, description }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{description}</p>}
    </div>
  );
}

function DetailRow({ Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{label}</p>
        <div className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{children}</div>
      </div>
    </div>
  );
}

function BillingSection() {
  const { user } = useAuth();
  const { workspaces } = useWorkspaces();

  const owned = workspaces.filter((w) => w.ownerId === user?.id);
  const seats = owned.reduce((sum, w) => sum + (w.memberCount || 0), 0);

  const usage = [
    { label: "Workspaces you own", value: owned.length },
    { label: "Members across them", value: seats },
    { label: "Workspaces you're in", value: workspaces.length },
  ];

  return (
    <section>
      <SectionHeading title="Billing" description="Your plan, what you're using, and how you pay." />

      <div className="space-y-4">
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <span className="brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">Free plan</p>
              <span className="chip">Current plan</span>
            </div>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              Billing isn't set up yet, so every workspace is on the Free plan. There's nothing to pay.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {usage.map((u) => (
            <div key={u.label} className="stat-card">
              <p className="stat-value tabular-nums">{u.value}</p>
              <p className="stat-label">{u.label}</p>
            </div>
          ))}
        </div>

        <div className="card divide-y divide-ink-900/[0.06] dark:divide-white/[0.06]">
          <DetailRow Icon={CreditCard} label="Payment method">
            None on file. The Free plan doesn't need one.
          </DetailRow>
          <DetailRow Icon={Mail} label="Billing email">
            <span className="break-all">{user?.email}</span>
          </DetailRow>
          <DetailRow Icon={Receipt} label="Invoices">
            No invoices yet.
          </DetailRow>
        </div>
      </div>
    </section>
  );
}

export default function Settings() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <BillingSection />
    </div>
  );
}
