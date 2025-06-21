import { create as createIPFSClient, IPFSHTTPClient } from "ipfs-http-client";
import { IPFS_ENDPOINTS, type Endpoint } from "./ipfsEndpoints";

let activeEndpoint: Endpoint = IPFS_ENDPOINTS[0];
let ipfs: IPFSHTTPClient = createIPFSClient({ url: activeEndpoint.apiUrl });

export async function initIPFSEndpoint() {
  for (const ep of IPFS_ENDPOINTS) {
    try {
      const ping = await fetch(`${ep.apiUrl}/id`);
      if (ping.ok) {
        activeEndpoint = ep;
        console.log("Using Cluster endpoint:", ep.name);
        ipfs = createIPFSClient({ url: activeEndpoint.apiUrl });
        return;
      }
    } catch (e) {
      console.warn(`${ep.name} failed, trying next`);
    }
  }
  console.error("No working IPFS Cluster endpoint available");
}

export function getIPFSClient() {
  return ipfs;
}

export function getGatewayUrl(cid: string) {
  return activeEndpoint.gatewayUrl + cid;
}

export function getEndpoint() {
  return activeEndpoint;
}

export async function uploadAndPin(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(
    `${activeEndpoint.apiUrl}/add?replication-min=1&replication-max=2`,
    {
      method: "POST",
      body: form,
    }
  );

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  const cid = data.cid["/"] || data.cid;

  console.log(`✅ File uploaded and pinned: ${cid}`);
  return cid;
}

export async function unpinFromCluster(cid: string): Promise<void> {
  try {
    await fetch(`${activeEndpoint.apiUrl}/pins/${cid}`, { method: "DELETE" });
  } catch (err: any) {
    const status = err.response?.status ?? err.status;
    if (status === 404) {
      console.warn(`File ${cid} not found in cluster, skipping.`);
    } else {
      throw new Error(`Unpin failed: ${err.message}`);
    }
  }

  //   if (!res.ok) {
  // throw new Error(`Unpin failed: ${res.statusText}`)

  console.log(`🗑️ CID unpinned: ${cid}`);
}
