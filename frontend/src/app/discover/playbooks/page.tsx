"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getOffer } from "@/lib/api/settings";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/common/EmptyState";

const FALLBACK = [
  {
    id: "infra",
    name: "Infrastructure expansion",
    templateKey: "infrastructure",
    blurb: "Facility growth, compute, storage, and resilience projects.",
    evidence: "Expansion announcements, site builds, capacity spend signals",
    question: "Where is new infrastructure creating a buying window?",
  },
  {
    id: "hire",
    name: "Hiring demand",
    templateKey: "recruitment",
    blurb: "Infrastructure and platform hiring that implies change.",
    evidence: "IT infrastructure / platform role postings",
    question: "Which teams are staffing for a refresh or migration?",
  },
  {
    id: "msp",
    name: "Multi-site IT support",
    templateKey: "managed_it",
    blurb: "Distributed estates needing managed compute and support.",
    evidence: "Multi-site operations, MSP transitions, refresh cycles",
    question: "Where can Lenovo-style infrastructure offers land next?",
  },
];

export default function PlaybooksPage() {
  const { workspaceId, loading, error } = useWorkspace();
  const [playbooks, setPlaybooks] = useState<
    Array<{ id: string; name: string; templateKey: string; version?: number }>
  >([]);

  useEffect(() => {
    if (!workspaceId) return;
    void getOffer(workspaceId).then((r) =>
      setPlaybooks(r.playbooks as Array<{ id: string; name: string; templateKey: string; version?: number }>),
    );
  }, [workspaceId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const cards =
    playbooks.length > 0
      ? playbooks.map((p) => {
          const meta = FALLBACK.find((f) => f.templateKey === p.templateKey) ?? FALLBACK[0];
          return {
            id: p.id,
            name: p.name,
            blurb: meta.blurb,
            evidence: meta.evidence,
            question: meta.question,
            version: p.version,
          };
        })
      : FALLBACK;

  return (
    <div>
      <PageHeader
        eyebrow="Playbooks"
        title="Signal playbooks"
        description="Choose sales context before finding accounts. Executed playbook version is stored with each research run."
      />

      {!cards.length ? (
        <EmptyState title="No playbooks" detail="Run backend db:seed to load defaults." />
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <h2 className="text-[17px]">{p.name}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{p.blurb}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    Required evidence
                  </p>
                  <p className="mt-1 text-[var(--foreground)]">{p.evidence}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                    Discovery question
                  </p>
                  <p className="mt-1 text-[var(--foreground)]">{p.question}</p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                <Link href="/discover/search">
                  <Button variant="primary" className="w-full">
                    Use playbook
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
