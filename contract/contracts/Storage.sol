// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Storage {
    // Owner of the whole contract
    address public owner;

    uint8 public constant MAX_MEMBERS = 255;

    // Permission bit-flags
    uint8 constant PERM_ADD_MEMBER        = 1 << 0;
    uint8 constant PERM_REMOVE_MEMBER     = 1 << 1;
    uint8 constant PERM_UPLOAD            = 1 << 2;
    uint8 constant PERM_DELETE            = 1 << 3;
    uint8 constant PERM_MANAGE_PERMISSIONS= 1 << 4;

    // Counters
    uint256 public folderCount;
    uint256 public fileCount;

    // Simple file struct
    struct File {
        address uploader;
        string fileName;
        string cid;
        bool available;
    }

    struct Folder {
        address folderOwner;
        string folderName;
        string folderId;
        address[] members;
        mapping(address => bool) isMember;
        mapping(address => bytes) encryptedFolderKey;
    }




    // Folder mappings
    mapping(uint256 => Folder)                        private folders;
    mapping(uint256 => mapping(address => uint8))     private permissions;
    mapping(uint256 => mapping(uint256 => File))      private files;
    mapping(uint256 => uint256[])                     private folderFiles;

    // Personal file mappings
    mapping(address => mapping(uint256 => File))      private personalFiles;
    mapping(address => uint256[])                     private personalFileIds;
    mapping(address => uint256)                       private personalFileCount;

    mapping(address=>string) public encryptionKeys;


    // ----- EVENTS -----
    event OwnerUpdated(address indexed newOwner);
    event FolderCreated(uint256 indexed folderId, address indexed owner, string name);
    event MemberAdded(uint256 indexed folderId, address indexed member);
    event MemberRemoved(uint256 indexed folderId, address indexed member);
    event PermissionsUpdated(uint256 indexed folderId, address indexed member, uint8 perms);
    event FolderKeyWrapped(uint256 indexed folderId, address indexed member);
    event FileUploaded(uint256 indexed folderId, uint256 indexed fileId, address indexed uploader, string fileName, string cid);
    event FileDeleted(uint256 indexed folderId, uint256 indexed fileId, address indexed deleter);

    // ----- CONSTRUCTOR & OWNER LOGIC -----
    constructor() {
        owner = msg.sender;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "Only current owner");
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

 // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier hasPermission(uint256 folderId, uint8 perm) {
        require(
            permissions[folderId][msg.sender] & perm != 0,
            "No permission"
        );
        _;
    }


    /// @notice Update contract owner
    function updateOwner(address _owner) external onlyOwner {
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    /// @notice Create a new folder with initial members and their wrapped AES key
    function createFolder( string calldata name, address[] calldata initialMembers, bytes[] calldata encryptedKeys) external returns (uint256) {
        require(initialMembers.length == encryptedKeys.length, "Members/keys mismatch");
        require(initialMembers.length <= MAX_MEMBERS,            "Too many members");

        uint256 folderId = folderCount++;
        Folder storage f = folders[folderId];
        f.folderOwner = msg.sender;
        f.folderName  = name;

        // Grant full perms to folder owner
        permissions[folderId][msg.sender] =
            PERM_ADD_MEMBER |
            PERM_REMOVE_MEMBER |
            PERM_UPLOAD |
            PERM_DELETE |
            PERM_MANAGE_PERMISSIONS;

        // Add each initial member
        for (uint i = 0; i < initialMembers.length; i++) {
            address m = initialMembers[i];
            f.members.push(m);
            f.isMember[m] = true;
            f.encryptedFolderKey[m] = encryptedKeys[i];

            emit FolderKeyWrapped(folderId, m);
        }

        emit FolderCreated(folderId, msg.sender, name);
        return folderId;
    }

    /// @notice Add a member to a folder
    function addMember( uint256 folderId, address newMember, bytes calldata encryptedKey) external hasPermission(folderId, PERM_ADD_MEMBER) {
        Folder storage f = folders[folderId];
        require(!f.isMember[newMember], "Already a member");
        require(f.members.length < MAX_MEMBERS, "Member limit reached");

        f.members.push(newMember);
        f.isMember[newMember] = true;
        f.encryptedFolderKey[newMember] = encryptedKey;

        // Default new perms: upload only
        permissions[folderId][newMember] = PERM_UPLOAD;
        emit MemberAdded(folderId, newMember);
        emit FolderKeyWrapped(folderId, newMember);
    }

    /// @notice Remove a member from a folder
    function removeMember(uint256 folderId, address member) external hasPermission(folderId, PERM_REMOVE_MEMBER){
        Folder storage f = folders[folderId];
        require(f.isMember[member], "Not a member");

        // swap-and-pop
        for (uint i = 0; i < f.members.length; i++) {
            if (f.members[i] == member) {
                f.members[i] = f.members[f.members.length - 1];
                f.members.pop();
                break;
            }
        }
        f.isMember[member] = false;
        delete permissions[folderId][member];
        delete f.encryptedFolderKey[member];

        emit MemberRemoved(folderId, member);
    }

    /// @notice Update a member's permissions
    function setMemberPermissions( uint256 folderId, address member, uint8 perms) external hasPermission(folderId, PERM_MANAGE_PERMISSIONS) {
        require(folders[folderId].isMember[member], "Not a member");
        permissions[folderId][member] = perms;
        emit PermissionsUpdated(folderId, member, perms);
    }

    /// @notice Return the permission bitmask for `member` in `folderId`
    function getMemberPermissions(uint256 folderId, address member) external view returns (uint8){
    require(msg.sender == folders[folderId].folderOwner || (permissions[folderId][msg.sender] & PERM_MANAGE_PERMISSIONS) != 0,"Not authorized");
    return permissions[folderId][member];
    }

    /// @notice Return *your* permissions in a folder
    function myPermissions(uint256 folderId) external view returns (uint8){
    return permissions[folderId][msg.sender];
    }

    /// @notice Rotate the folder AES key for all members
    function rotateFolderKey( uint256 folderId, bytes[] calldata encryptedKeys) external hasPermission(folderId, PERM_MANAGE_PERMISSIONS) {
        Folder storage f = folders[folderId];
        require(encryptedKeys.length == f.members.length, "Keys count mismatch");

        for (uint i = 0; i < f.members.length; i++) {
            address m = f.members[i];
            f.encryptedFolderKey[m] = encryptedKeys[i];
            emit FolderKeyWrapped(folderId, m);
        }
    }

    /// @notice Upload a file to a folder
    function uploadFile(uint256 folderId, string calldata fileName, string calldata cid) external hasPermission(folderId, PERM_UPLOAD) returns (uint256) {
        uint256 fid = fileCount++;
        files[folderId][fid] = File(msg.sender, fileName, cid, true);
        folderFiles[folderId].push(fid);
        emit FileUploaded(folderId, fid, msg.sender, fileName, cid);
        return fid;
    }

    /// @notice Delete a file from a folder
    function deleteFile(uint256 folderId, uint256 fileId)external hasPermission(folderId, PERM_DELETE){
        File storage fe = files[folderId][fileId];
        require(fe.available, "File is not available");

        delete files[folderId][fileId];
        uint256[] storage arr = folderFiles[folderId];
        for (uint i = 0; i < arr.length; i++) {
            if (arr[i] == fileId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
        emit FileDeleted(folderId, fileId, msg.sender);
    }

    /// @notice Fetch wrapped AES key for caller
    function getEncryptedFolderKey(uint256 folderId)external view returns (bytes memory){
        Folder storage f = folders[folderId];
        require(f.isMember[msg.sender], "Not a member");
        return f.encryptedFolderKey[msg.sender];
    }

    /// @notice get folder owner
    function getFolderOwner(uint256 folderId) external view returns (address folderOwner){
        return folders[folderId].folderOwner;
    }

    /// @notice List members of a folder
    function getFolderMembers(uint256 folderId) external view returns (address[] memory){
        return folders[folderId].members;
    }

    /// @notice List file IDs in a folder
    function getFolderFiles(uint256 folderId) external view returns (uint256[] memory){
        return folderFiles[folderId];
    }

    function getFolderFile( uint256 folderId, uint256 fileId) external view returns (address uploader, string memory fileName, string memory cid){
        File storage fe = files[folderId][fileId];
        require(fe.available, "File is not available");
        return (fe.uploader, fe.fileName, fe.cid);
    }


/// @notice Return all personal folder IDs and their names in one call
function getPersonalFolders() external view returns ( uint256[] memory folderIds, string[]  memory folderNames ){
  uint total = folderCount;
  uint c = 0;
  for (uint i = 0; i < total; i++) {
    if (folders[i].members.length == 1
     && folders[i].members[0] == msg.sender) {
      c++;
    }
  }


  folderIds   = new uint256[](c);
  folderNames = new string[](c);
  uint idx = 0;

  for (uint i = 0; i < total; i++) {
    if (folders[i].members.length == 1
     && folders[i].members[0] == msg.sender) {
      folderIds[idx]   = i;
      folderNames[idx] = folders[i].folderName;
      idx++;
    }
  }
}

    /// @notice List all folder IDs where caller is a member of a group (members>1)
    function getGroupFolders() external view returns ( uint256[] memory folderIds, string[]  memory folderNames){
        uint total = folderCount;
        uint countGroup = 0;
        for (uint i = 0; i < total; i++) {
            Folder storage f = folders[i];
            if (f.isMember[msg.sender] && f.members.length > 1) {
                countGroup++;
            }
        }
        folderIds   = new uint256[](countGroup);
        folderNames = new string[](countGroup);
        uint idx = 0;
        for (uint i = 0; i < total; i++) {
            Folder storage f = folders[i];
            if (f.isMember[msg.sender] && f.members.length > 1) {
                folderIds[idx]   = i;
                folderNames[idx] = f.folderName;
                idx++;
            }
        }
    }

    /// @notice Return the name of a folder
    function getFolderName(uint256 folderId) external view returns (string memory) {
        return folders[folderId].folderName;
    }

    /// @notice Upload a personal file (no folder required)
    function uploadPersonalFile(string calldata fileName, string calldata cid) external returns (uint256) {
        uint256 fid = personalFileCount[msg.sender]++;
        personalFiles[msg.sender][fid] = File(msg.sender, fileName, cid, true);
        personalFileIds[msg.sender].push(fid);
        return fid;
    }

    /// @notice Delete a personal file
    function deletePersonalFile(uint256 fileId) external {
        File storage fe = personalFiles[msg.sender][fileId];
        require(fe.available, "File is not available");
        delete personalFiles[msg.sender][fileId];
        uint256[] storage arr = personalFileIds[msg.sender];
        for (uint i = 0; i < arr.length; i++) {
            if (arr[i] == fileId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }

    }

        /// @notice List personal file IDs for caller
    function getPersonalFileIds() external view returns (uint256[] memory) {
        return personalFileIds[msg.sender];
    }

    /// @notice Fetch a personal file entry
    function getPersonalFile(uint256 fileId) external view returns (string memory fileName, string memory cid) {
        File storage fe = personalFiles[msg.sender][fileId];
        require(fe.available, "File is not available");
        return (fe.fileName, fe.cid);
    }

    function registerEncryptionKey(string calldata pubKey)external{
        encryptionKeys[msg.sender] = pubKey;
    }

    function getEncryptionKeys(address[] calldata users)
        external
        view
        returns (string[] memory keys)
    {
        uint256 len = users.length;
        keys = new string[](len);

        for (uint256 i = 0; i < len; i++) {
            // If a user hasn’t registered their key, return empty string.
            keys[i] = encryptionKeys[users[i]];
        }
    }

}
