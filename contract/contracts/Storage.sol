// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Storage {
    // Owner of the whole contract
    address public owner;

    // Simple file struct
    struct File {
        string fileName;
        string cid;
    }

    // Per-user personal files
    mapping(address => File[]) private userFiles;

    // ----- GROUPS -----
    struct Group {
        string name;
        address admin;
    }

    uint public groupCount;
    mapping(uint => Group) public groups;
    // track members per group
    mapping(uint => address[]) private groupMembers;
    mapping(uint => mapping(address => bool)) private isMember;
    // track files per group
    mapping(uint => File[]) private groupFiles;

    // ----- EVENTS -----
    event OwnerUpdated(address indexed newOwner);
    event GroupCreated(uint indexed groupId, string name, address indexed admin);
    event MemberAdded(uint indexed groupId, address indexed member);
    event MemberRemoved(uint indexed groupId, address indexed member);
    event FileSharedToGroup(uint indexed groupId, string fileName, string cid);

    // ----- CONSTRUCTOR & OWNER LOGIC -----
    constructor() {
        owner = msg.sender;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "Only current owner");
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    // ----- PERSONAL FILES -----
    function uploadFile(string calldata fileName, string calldata cid) external {
        userFiles[msg.sender].push(File(fileName, cid));
    }

    function getMyFiles() external view returns (File[] memory) {
        return userFiles[msg.sender];
    }

    // ----- GROUP MANAGEMENT -----
    /// @notice Create a new group with you as admin
    function createGroup(string calldata name) external returns (uint) {
        groupCount++;
        groups[groupCount] = Group(name, msg.sender);
        groupMembers[groupCount].push(msg.sender);
        isMember[groupCount][msg.sender] = true;
        emit GroupCreated(groupCount, name, msg.sender);
        return groupCount;
    }

    /// @notice Admin adds a member
    function addMember(uint groupId, address member) external {
        Group storage g = groups[groupId];
        require(msg.sender == g.admin, "Only admin");
        require(!isMember[groupId][member], "Already a member");
        groupMembers[groupId].push(member);
        isMember[groupId][member] = true;
        emit MemberAdded(groupId, member);
    }

    /// @notice Admin removes a member
    function removeMember(uint groupId, address member) external {
        Group storage g = groups[groupId];
        require(msg.sender == g.admin, "Only admin");
        require(isMember[groupId][member], "Not a member");

        // remove flag
        isMember[groupId][member] = false;

        // remove from array
        address[] storage mems = groupMembers[groupId];
        for (uint i = 0; i < mems.length; i++) {
            if (mems[i] == member) {
                mems[i] = mems[mems.length - 1];
                mems.pop();
                break;
            }
        }
        emit MemberRemoved(groupId, member);
    }

    /// @notice Get list of members
    function getGroupMembers(uint groupId) external view returns (address[] memory) {
        return groupMembers[groupId];
    }

    // ----- GROUP FILES -----
    /// @notice Any member can share a file to the group
    function shareFileToGroup(uint groupId, string calldata fileName, string calldata cid) external {
        require(isMember[groupId][msg.sender], "Not authorized");
        groupFiles[groupId].push(File(fileName, cid));
        emit FileSharedToGroup(groupId, fileName, cid);
    }

    /// @notice Members can fetch all files in the group
    function getGroupFiles(uint groupId) external view returns (File[] memory) {
        require(isMember[groupId][msg.sender], "Not authorized");
        return groupFiles[groupId];
    }
}
