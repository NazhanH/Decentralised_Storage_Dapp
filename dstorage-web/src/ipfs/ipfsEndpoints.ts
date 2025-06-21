export interface Endpoint {
  name: string;
  apiUrl: string;
  gatewayUrl: string;
}

export const IPFS_ENDPOINTS: Endpoint[] = [
  {
    name: "DO_Node",
    apiUrl: "http://188.166.215.198:9094",
    gatewayUrl: "http://188.166.215.198:8080/ipfs/",
  },
];
