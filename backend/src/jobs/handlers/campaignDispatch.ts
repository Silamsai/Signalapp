import { processDueEnrollments } from "../../services/campaigns.js";

export async function handleCampaignDispatch() {
  return processDueEnrollments(50);
}
