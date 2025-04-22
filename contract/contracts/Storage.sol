//spdx-license-identifier: MIT
pragma solidity ^0.8.28;

contract Storage {
    // Storage variables

    address public owner;

    struct File{
        string fileName;
        string cid;
    }

    mapping (address => File[]) private userFiles;

    event OwnerUpdated(address indexed newOwner);

    // Constructor
    constructor() {
        owner = msg.sender;
    }



    function setOwner(address _owner) external {
        require(msg.sender == owner, "Only the current owner can change the owner");
        owner = _owner;
        emit OwnerUpdated(_owner);
    }
}