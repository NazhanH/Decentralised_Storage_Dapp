# Instructions  
  
## **__Requirements__**  
installed npm. you can do so by installing [Node.js](https://nodejs.org/en/download).  
installed the metamask extension on your browser of choice.  
  
## Setting up
1. clone or download this repository into a directory
2. open your terminal and navigate into /contracts by 'cd .\contracts'
3. run 'npm install' in the terminal to download the required packages
4. run 'npx hardhat node' in the terminal. **do not close this terminal**
5. open a new terminal on the current directory and run 'npx hardhat run scripts/deploy.ts --network localhost'
6. navigate to /dstorage-web
7. run 'npm install' in the terminal to download the required packages
8. run 'npm run dev' in the terminal to start the webserver
9. the web app should run at [http://localhost:5173/](http://localhost:5173/)
10. you need to have finished setting up metamask and import test accounts to use the web app

## setting up metamask
1. if you've already finished the initial setting up of metamask we will have to configure it to interact with our local testnet.  
2. open metamask and at the top right corner there should be options to choose networks, select it.  
3. once you've selected it there should be a popup listing networks. at the bottom there should an option to add a network. select it.
4. Network name: anything, preferably localnet
5. add default rpc URl: http://127.0.0.1:8545
6. Chain ID: 3137
7. Currency Symbol: ETH
8. Block explorer URL: ignore
9. select save.
10. Use the newly added local testnet by selecting it in the network list.

### import test accounts
1. when you ran 'npx hardhat node' a list of accounts and their private keys should pop up.  
2. open metamask
3. ensure that you are currently using the local test net 
4. on the top centre of the metamask extension window there should be an option to select accounts. select it.
5. select the option to add account.
6. choose the option to import a private key.
7. go to the terminal that lists accounts and private keys and copy a private key.
8. paste the private key into metamask and select import.
9. the account should be added to metamask.
10. Repeat for how much accounts you want to use.

