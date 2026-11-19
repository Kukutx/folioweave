import { handlePodcastRequest } from "@/demo/podcast-route";

export async function GET() {
  return handlePodcastRequest();
}
