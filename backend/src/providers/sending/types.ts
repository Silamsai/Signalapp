export type SendRequest = {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  idempotencyKey: string;
};

export type SendResult = {
  providerMessageId: string;
  status: "submitted" | "delivery_confirmed" | "bounced" | "failed";
  detail?: string;
};

export interface SendingProvider {
  name: string;
  send(req: SendRequest): Promise<SendResult>;
}
