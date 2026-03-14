const APIFY_BASE_URL = "https://api.apify.com/v2";

function getToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN environment variable is required");
  return token;
}

export interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
}

export async function startActorRun(actorId: string, input: any): Promise<ApifyRunResult> {
  const token = getToken();
  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify start run failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const data = json.data;
  return {
    id: data.id,
    status: data.status,
    defaultDatasetId: data.defaultDatasetId,
  };
}

export async function pollRunStatus(runId: string, maxWaitMs: number = 720000, pollIntervalMs: number = 15000): Promise<ApifyRunResult> {
  const token = getToken();
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const url = `${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Apify poll failed (${res.status})`);
    }
    const json = await res.json();
    const data = json.data;
    const status = data.status;

    if (status === "SUCCEEDED") {
      return { id: data.id, status, defaultDatasetId: data.defaultDatasetId };
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${runId} ended with status: ${status}`);
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Apify run ${runId} timed out after ${maxWaitMs}ms`);
}

export async function fetchDatasetTsv(datasetId: string): Promise<string> {
  const token = getToken();
  const url = `${APIFY_BASE_URL}/datasets/${datasetId}/items?format=csv&delimiter=tab&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Apify dataset fetch failed (${res.status})`);
  }
  return await res.text();
}
