import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export default function HowItWorksPage() {
  return (
    <div>
      <PageHeader
        eyebrow="How it works"
        title="How it works"
        description="Phase 1 sales enablement flow from the Infrastructure Signal specification."
      />
      <Card>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-[var(--foreground)]">
          <li>Grant workspace members under Settings → Members; revoke removes access immediately.</li>
          <li>Configure offer, territory, and playbook under Settings.</li>
          <li>Discover or import accounts (CSV). Review merge candidates; imports start unresearched.</li>
          <li>
            Queue Exa research jobs; review cited evidence with separate event/discovery/check
            dates. Unknown and contradictory facts stay flagged.
          </li>
          <li>Build a qualification brief — unknown is valid; do not invent contacts or intent.</li>
          <li>
            Submit for sales acceptance; reviewers need evidence, owner, and next action. Material
            changes after accept require re-review.
          </li>
          <li>Assign SDR tasks and edit drafts. Task complete needs an outcome; Phase 1 never sends email.</li>
          <li>Record partner handoffs as Prepared until Shared; partners only see permitted fields.</li>
          <li>Track outcomes with disclosed cohort, denominators, and currency. Suppression is honored end-to-end.</li>
        </ol>
      </Card>
    </div>
  );
}
