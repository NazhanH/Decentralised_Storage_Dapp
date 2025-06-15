const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Storage (Custom Errors)", function () {
  let Storage, storage, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    Storage = await ethers.getContractFactory("Storage");
    storage = await Storage.deploy();
  });

  it("setOwner: non-owner reverts NotContractOwner", async function () {
    await expect(storage.connect(addr1).setOwner(addr2.address))
      .to.be.revertedWithCustomError(storage, "NotContractOwner");
  });

  it("createFolder: mismatched arrays reverts MembersKeysMismatch", async function () {
    await expect(
      storage.createFolder("F", [addr1.address], [])
    ).to.be.revertedWithCustomError(storage, "MembersKeysMismatch");
  });

  it("createFolder: too many members reverts MemberLimitReached", async function () {
    const big = Array(256).fill(owner.address);
    const keys = big.map(() =>
      ethers.hexlify(ethers.randomBytes(32))
    );
    await expect(storage.createFolder("X", big, keys))
      .to.be.revertedWithCustomError(storage, "MemberLimitReached");
  });

  it("addMember: duplicate reverts AlreadyMember", async function () {
    await storage.createFolder("G", [], []);
    const key = ethers.hexlify(ethers.randomBytes(32));
    await storage.addMember(0, addr1.address, key);
    await expect(storage.addMember(0, addr1.address, key))
      .to.be.revertedWithCustomError(storage, "AlreadyMember");
  });

  it("removeMember: non-member reverts NotAMember", async function () {
    await storage.createFolder("H", [], []);
    await expect(storage.removeMember(0, addr1.address))
      .to.be.revertedWithCustomError(storage, "NotAMember");
  });

  it("removeMember: self remove by manager reverts CannotRemoveSelf", async function () {
    // 1) create folder and add addr1
    const key = ethers.hexlify(ethers.randomBytes(32));
    await storage.createFolder("I", [], []);
    await storage.addMember(0, addr1.address, key);

    // 2) owner grants addr1 manage permission
    await storage.setMemberPermissions(0, addr1.address, 1 << 0); // PERM_MANAGE_PERMISSIONS

    // 3) now addr1 can call removeMember but can't remove self
    await expect(storage.connect(addr1).removeMember(0, addr1.address))
      .to.be.revertedWithCustomError(storage, "CannotRemoveSelf");
  });

  it("removeMember: manager cannot remove another manager reverts CannotRemoveManager", async function () {
    // create folder and add both addr1 & addr2
    const key1 = ethers.hexlify(ethers.randomBytes(32));
    const key2 = ethers.hexlify(ethers.randomBytes(32));
    await storage.createFolder("J", [], []);
    await storage.addMember(0, addr1.address, key1);
    await storage.addMember(0, addr2.address, key2);

    // owner grants manage to both
    await storage.setMemberPermissions(0, addr1.address, 1 << 0);
    await storage.setMemberPermissions(0, addr2.address, 1 << 0);

    // now addr1 (a manager) tries to remove addr2 (also a manager)
    await expect(storage.connect(addr1).removeMember(0, addr2.address))
      .to.be.revertedWithCustomError(storage, "CannotRemoveManager");
  });

  it("removeMember: owner can remove a manager", async function () {
    // same setup as above
    const key = ethers.hexlify(ethers.randomBytes(32));
    await storage.createFolder("K", [], []);
    await storage.addMember(0, addr1.address, key);
    await storage.setMemberPermissions(0, addr1.address, 1 << 0);

    // owner removes the manager successfully (no revert)
    await expect(storage.removeMember(0, addr1.address))
      .not.to.be.reverted;
  });

  it("leaveFolder: owner leave reverts OwnerCannotLeave", async function () {
    const ownerKey = ethers.hexlify(ethers.randomBytes(32));
    // include owner in the members list so leaveFolder sees them
    await storage.createFolder("K", [owner.address], [ownerKey]);
    await expect(storage.leaveFolder(0))
      .to.be.revertedWithCustomError(storage, "OwnerCannotLeave");
  });

  it("deleteFolder: non-owner reverts OnlyFolderOwner", async function () {
    await storage.createFolder("L", [], []);
    await expect(storage.connect(addr1).deleteFolder(0))
      .to.be.revertedWithCustomError(storage, "OnlyFolderOwner");
  });

  it("deleteFile: file not available reverts FileNotAvailable", async function () {
    await storage.createFolder("M", [], []);
    await expect(storage.deleteFile(0, 0))
      .to.be.revertedWithCustomError(storage, "FileNotAvailable");
  });

  it("rotateFolderKey: mismatch reverts KeysCountMismatch", async function () {
    const key = ethers.hexlify(ethers.randomBytes(32));
    await storage.createFolder("N", [addr1.address], [key]);
    await expect(storage.rotateFolderKey(0, []))
      .to.be.revertedWithCustomError(storage, "KeysCountMismatch");
  });
});
