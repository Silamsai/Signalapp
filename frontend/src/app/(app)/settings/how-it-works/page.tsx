import { PageHeader } from "../../../../components/layout/PageHeader";

export default function HowItWorksPage() {
  return (
    <div>
      <PageHeader
        title="How it works"
        description="Phase 1 sales enablement flow from the Infrastructure Signal specification."
      />
      <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
        <li>Configure offer, territory, and playbook under Settings.</li>
        <li>Discover or import accounts (CSV). Imports start as unresearched.</li>
        <li>Queue Exa research jobs; review cited evidence with separate event/discovery/check dates.</li>
        <li>Build a qualification brief — unknown is valid; do not invent contacts or intent.</li>
        <li>Submit for sales acceptance; reviewers accept, return, or reject with reasons.</li>
        <li>Assign SDR tasks and edit drafts. Phase 1 never sends email.</li>
        <li>Record partner handoffs as Prepared until explicitly Shared.</li>
        <li>Track outcomes with disclosed denominators and cohorts.</li>
      </ol>
    </div>
  );
}
