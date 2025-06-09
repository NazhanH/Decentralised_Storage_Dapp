export interface Endpoint{
    name: string
    apiUrl: string
    gatewayUrl: string
}

export const IPFS_ENDPOINTS: Endpoint[] = [
    {
        name: 'Localhost IPFS',
        apiUrl: 'http://127.0.0.1:5001/api/v0',
        gatewayUrl: 'http://127.0.0.1/ipfs/',
    },
    {
        name: 'Node 1',
        apiUrl: 'http://192.168.0.135:5001/api/v0',
        gatewayUrl: 'http://192.168.0.135:8080/ipfs/',
    },
]