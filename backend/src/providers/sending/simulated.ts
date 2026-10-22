import { createHash } from "node:crypto";
import type { SendRequest, SendResult, SendingProvider } from "./types.js";

/** Dry-run sender — never contacts a real mailbox. */
export class SimulatedSendingProvider implements SendingProvider {
  name = "simulated";

  async send(req: SendRequest): Promise<SendResult> {
    const providerMessageId = createHash("sha256")
      .update(req.idempotencyKey)
      .digest("hex")
      .slice(0, 24);

    // Deterministic bounce for addresses containing +bounce
    if (req.to.toLowerCase().includes("+bounce")) {
      return {
        providerMessageId,
        status: "bounced",
        detail: "Simulated permanent bounce",
      };
    }

    return {
      providerMessageId,
      status: "delivery_confirmed",
      detail: "Simulated delivery confirmation",
    };
  }
}
