import { create as createIPFSClient, IPFSHTTPClient } from 'ipfs-http-client'
import { IPFS_ENDPOINTS, type Endpoint } from './ipfsEndpoints'

let activeEndpoint: Endpoint = IPFS_ENDPOINTS[0]
let ipfs: IPFSHTTPClient = createIPFSClient({ url: activeEndpoint.apiUrl })

/**
 * Try each endpoint in order, pick the first that responds to /version
 */
export async function initIPFSEndpoint() {
  for (const ep of IPFS_ENDPOINTS) {
    try {
      const client = createIPFSClient({ url: ep.apiUrl })
      await client.version()          // does a POST /version
      activeEndpoint = ep
      ipfs = client
      console.log('Using IPFS endpoint:', ep.name)
      return
    } catch (e) {
      console.warn(`${ep.name} failed, trying next`)
    }
  }
  console.error('no IPFS endpoint available')
}

export function getIPFSClient() {
  return ipfs
}

export function getGatewayUrl(cid: string) {
  return activeEndpoint.gatewayUrl + cid
}

export function getEndpoint() {
  return activeEndpoint
}
