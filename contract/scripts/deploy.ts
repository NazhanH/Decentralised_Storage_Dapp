// scripts/deploy.ts
import { ethers } from "hardhat";

async function main() {
  const Contract = await ethers.getContractFactory("Storage");
  const contract = await Contract.deploy();
  console.log("Contract deployed at:", contract.target);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
