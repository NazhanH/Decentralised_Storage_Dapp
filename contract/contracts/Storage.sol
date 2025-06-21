// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

error NotContractOwner();
error NoPermission();
error MembersKeysMismatch();
error AlreadyMember();
error MemberLimitReached();
error NotAuthorized();
error NotAMember();
error CannotRemoveSelf();
error NoPermissionToRemove();
error CannotRemoveManager();
error CannotChangeOwnPermissions();
error OnlyUploadDeletePermissions();
error KeysCountMismatch();
error FileNotAvailable();
error OwnerCannotLeave();
error OnlyFolderOwner();

contract Storage {
    // Owner of the whole contract
    address public owner;

    uint8 public constant MAX_MEMBERS = 255;

    // Permission bit-flags
    uint8 constant PERM_MANAGE_PERMISSIONS = 1 << 0;
    uint8 constant PERM_UPLOAD = 1 << 1;
    uint8 constant PERM_DELETE = 1 << 2;

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
    mapping(uint256 => Folder) private folders;
    mapping(uint256 => mapping(address => uint256)) private folderMemberIndex;
    mapping(uint256 => mapping(address => uint8)) private permissions;
    mapping(uint256 => mapping(uint256 => File)) private files;
    mapping(uint256 => uint256[]) private folderFiles;

    mapping(address => uint256[]) private userFolders;
    mapping(address => mapping(uint256 => uint256)) private userFolderIndex;

    // Personal file mappings
    mapping(address => mapping(uint256 => File)) private personalFiles;
    mapping(address => uint256[]) private personalFileIds;
    mapping(address => uint256) private personalFileCount;

    mapping(address => string) public encryptionKeys;

    // ----- EVENTS -----
    event OwnerUpdated(address indexed newOwner);
    event FolderCreated(
        uint256 indexed folderId,
        address indexed owner,
        string name
    );
    event MemberAdded(uint256 indexed folderId, address indexed member);
    event MemberRemoved(uint256 indexed folderId, address indexed member);
    event PermissionsUpdated(
        uint256 indexed folderId,
        address indexed member,
        uint8 perms
    );
    event FolderKeyWrapped(uint256 indexed folderId, address indexed member);
    event FileUploaded(
        uint256 indexed folderId,
        uint256 indexed fileId,
        address indexed uploader,
        string fileName,
        string cid
    );
    event FileDeleted(
        uint256 indexed folderId,
        uint256 indexed fileId,
        address indexed deleter
    );

    // ----- CONSTRUCTOR & OWNER LOGIC -----
    constructor() {
        owner = msg.sender;
    }

    function setOwner(address _owner) external {
        if (msg.sender != owner) revert NotContractOwner();
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    // Modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotContractOwner();
        _;
    }

    modifier hasPermission(uint256 folderId, uint8 perm) {
        if (permissions[folderId][msg.sender] & perm == 0)
            revert NoPermission();
        _;
    }

    /// @notice Update contract owner
    function updateOwner(address _owner) external onlyOwner {
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    /// @notice Create a new folder with initial members and their wrapped AES key
    function createFolder(
        string calldata name,
        address[] calldata initialMembers,
        bytes[] calldata encryptedKeys
    ) external returns (uint256) {
        if (initialMembers.length != encryptedKeys.length)
            revert MembersKeysMismatch();
        if (initialMembers.length > MAX_MEMBERS) revert MemberLimitReached();

        uint256 folderId = folderCount++;
        Folder storage f = folders[folderId];
        f.folderOwner = msg.sender;
        f.folderName = name;

        // Grant full perms to folder owner
        permissions[folderId][msg.sender] =
            PERM_UPLOAD |
            PERM_DELETE |
            PERM_MANAGE_PERMISSIONS;

        // Add each initial member
        for (uint i = 0; i < initialMembers.length; i++) {
            address m = initialMembers[i];
            f.members.push(m);
            f.isMember[m] = true;
            f.encryptedFolderKey[m] = encryptedKeys[i];

            folderMemberIndex[folderId][m] = f.members.length - 1;
            userFolders[m].push(folderId);
            userFolderIndex[m][folderId] = userFolders[m].length - 1;

            emit FolderKeyWrapped(folderId, m);
        }

        emit FolderCreated(folderId, msg.sender, name);
        return folderId;
    }

    /// @notice Add a member to a folder
    function addMember(
        uint256 folderId,
        address newMember,
        bytes calldata encryptedKey
    ) external hasPermission(folderId, PERM_MANAGE_PERMISSIONS) {
        Folder storage f = folders[folderId];
        if (f.isMember[newMember]) revert AlreadyMember();
        if (f.members.length > MAX_MEMBERS) revert MemberLimitReached();

        f.members.push(newMember);
        folderMemberIndex[folderId][newMember] = f.members.length - 1;
        f.isMember[newMember] = true;
        f.encryptedFolderKey[newMember] = encryptedKey;

        userFolders[newMember].push(folderId);
        userFolderIndex[newMember][folderId] =
            userFolders[newMember].length -
            1;

        emit MemberAdded(folderId, newMember);
        emit FolderKeyWrapped(folderId, newMember);
    }

    /// @notice Remove a member from a folder
    function removeMember(
        uint256 folderId,
        address member
    ) external hasPermission(folderId, PERM_MANAGE_PERMISSIONS) {
        Folder storage f = folders[folderId];
        if (!f.isMember[member]) revert NotAMember();
        if (msg.sender == member) revert CannotRemoveSelf();

        bool isOwner = msg.sender == f.folderOwner;

        // If not the owner, cannot remove someone who also has MANAGE
        if (!isOwner) {
            if (
                (permissions[folderId][member] & PERM_MANAGE_PERMISSIONS) != 0
            ) {
                revert CannotRemoveManager();
            }
        }

        _removeFolderMember(folderId, member);

        f.isMember[member] = false;
        delete permissions[folderId][member];
        delete f.encryptedFolderKey[member];

        _removeUserFolder(member, folderId);

        emit MemberRemoved(folderId, member);
    }

    /// @notice Update a member's permissions
    function setMemberPermissions(
        uint256 folderId,
        address member,
        uint8 perms
    ) external hasPermission(folderId, PERM_MANAGE_PERMISSIONS) {
        Folder storage f = folders[folderId];
        if (!f.isMember[member]) revert NotAMember();

        // Folder owner has full rights including granting/removing MANAGE
        if (msg.sender == f.folderOwner) {
            if ((perms & PERM_MANAGE_PERMISSIONS) != 0) {
                perms |= (PERM_UPLOAD | PERM_DELETE);
            }

            permissions[folderId][member] = perms;
            emit PermissionsUpdated(folderId, member, perms);
            return;
        }

        // Cannot change your own permissions
        if (msg.sender == member) revert CannotChangeOwnPermissions();

        // Cannot assign/revoke MANAGE to others
        uint8 allowedPerms = PERM_UPLOAD | PERM_DELETE;
        if ((perms & ~allowedPerms) != 0) {
            revert OnlyUploadDeletePermissions();
        }

        permissions[folderId][member] = perms;
        emit PermissionsUpdated(folderId, member, perms);
    }

    /// @notice Return the permission bitmask for `member` in `folderId`
    function getMemberPermissions(
        uint256 folderId,
        address member
    ) external view returns (uint8) {
        Folder storage f = folders[folderId];
        if (!f.isMember[msg.sender]) revert NotAMember();
        return permissions[folderId][member];
    }

    /// @notice Return *your* permissions in a folder
    function myPermissions(uint256 folderId) external view returns (uint8) {
        return permissions[folderId][msg.sender];
    }

    /// @notice Rotate the folder AES key for all members
    function rotateFolderKey(
        uint256 folderId,
        bytes[] calldata encryptedKeys
    ) external hasPermission(folderId, PERM_MANAGE_PERMISSIONS) {
        Folder storage f = folders[folderId];
        if (encryptedKeys.length != f.members.length)
            revert KeysCountMismatch();

        for (uint i = 0; i < f.members.length; i++) {
            address m = f.members[i];
            f.encryptedFolderKey[m] = encryptedKeys[i];
            emit FolderKeyWrapped(folderId, m);
        }
    }

    /// @notice Upload a file to a folder
    function uploadFile(
        uint256 folderId,
        string calldata fileName,
        string calldata cid
    ) external hasPermission(folderId, PERM_UPLOAD) returns (uint256) {
        uint256 fid = fileCount++;
        files[folderId][fid] = File(msg.sender, fileName, cid, true);
        folderFiles[folderId].push(fid);
        emit FileUploaded(folderId, fid, msg.sender, fileName, cid);
        return fid;
    }

    /// @notice Delete a file from a folder
    function deleteFile(
        uint256 folderId,
        uint256 fileId
    ) external hasPermission(folderId, PERM_DELETE) {
        File storage fe = files[folderId][fileId];
        if (!fe.available) revert FileNotAvailable();

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
    function getEncryptedFolderKey(
        uint256 folderId
    ) external view returns (bytes memory) {
        Folder storage f = folders[folderId];
        if (!f.isMember[msg.sender]) revert NotAMember();
        return f.encryptedFolderKey[msg.sender];
    }

    /// @notice get folder owner
    function getFolderOwner(
        uint256 folderId
    ) external view returns (address folderOwner) {
        return folders[folderId].folderOwner;
    }

    /// @notice List members of a folder
    function getFolderMembers(
        uint256 folderId
    ) external view returns (address[] memory) {
        return folders[folderId].members;
    }

    /// @notice List file IDs in a folder
    function getFolderFiles(
        uint256 folderId
    ) external view returns (uint256[] memory) {
        return folderFiles[folderId];
    }

    function getFolderFile(
        uint256 folderId,
        uint256 fileId
    )
        external
        view
        returns (address uploader, string memory fileName, string memory cid)
    {
        File storage fe = files[folderId][fileId];
        if (!fe.available) revert FileNotAvailable();
        return (fe.uploader, fe.fileName, fe.cid);
    }

    /// @notice Return all personal folder IDs and their names in one call
    function getPersonalFolders()
        external
        view
        returns (uint256[] memory folderIds, string[] memory folderNames)
    {
        uint256[] storage my = userFolders[msg.sender];

        //Count how many are solo
        uint256 soloCount;
        for (uint256 i = 0; i < my.length; i++) {
            uint256 fid = my[i];
            if (folders[fid].members.length == 1) {
                soloCount++;
            }
        }

        // Build the arrays
        folderIds = new uint256[](soloCount);
        folderNames = new string[](soloCount);
        uint256 idx;
        for (uint256 i = 0; i < my.length; i++) {
            uint256 fid = my[i];
            if (folders[fid].members.length == 1) {
                folderIds[idx] = fid;
                folderNames[idx] = folders[fid].folderName;
                idx++;
            }
        }
    }

    /// @notice List all folder IDs where caller is a member of a group (members>1)
    function getGroupFolders()
        external
        view
        returns (
            uint256[] memory folderIds,
            string[] memory folderNames,
            address[] memory folderOwners
        )
    {
        uint256[] storage my = userFolders[msg.sender];

        // Count multi-member folders
        uint256 groupCount;
        for (uint256 i = 0; i < my.length; i++) {
            uint256 fid = my[i];
            if (folders[fid].members.length > 1) {
                groupCount++;
            }
        }

        // Build the arrays
        folderIds = new uint256[](groupCount);
        folderNames = new string[](groupCount);
        folderOwners = new address[](groupCount);
        uint256 idx2;
        for (uint256 i = 0; i < my.length; i++) {
            uint256 fid = my[i];
            if (folders[fid].members.length > 1) {
                folderIds[idx2] = fid;
                folderNames[idx2] = folders[fid].folderName;
                folderOwners[idx2] = folders[fid].folderOwner;
                idx2++;
            }
        }
    }

    /// @notice List all folder IDs where caller is the owner
    function getMyOwnedFolderIds()
        external
        view
        returns (uint256[] memory owned)
    {
        uint256[] storage mine = userFolders[msg.sender];

        // count how many owned folders there are
        uint256 cnt;
        for (uint256 i = 0; i < mine.length; i++) {
            uint256 fid = mine[i];
            if (folders[fid].folderOwner == msg.sender) {
                cnt++;
            }
        }

        // the array
        owned = new uint256[](cnt);

        //fill it
        uint256 idx;
        for (uint256 i = 0; i < mine.length; i++) {
            uint256 fid = mine[i];
            if (folders[fid].folderOwner == msg.sender) {
                owned[idx++] = fid;
            }
        }
    }

    /// @notice Return the name of a folder
    function getFolderName(
        uint256 folderId
    ) external view returns (string memory) {
        return folders[folderId].folderName;
    }

    function leaveFolder(uint256 folderId) public {
        Folder storage f = folders[folderId];
        if (!f.isMember[msg.sender]) revert NotAMember();
        if (f.folderOwner == msg.sender) revert OwnerCannotLeave();

        _removeFolderMember(folderId, msg.sender);
        _removeUserFolder(msg.sender, folderId);

        f.isMember[msg.sender] = false;
        delete permissions[folderId][msg.sender];
        delete f.encryptedFolderKey[msg.sender];

        emit MemberRemoved(folderId, msg.sender);
    }

    function _removeUserFolder(address user, uint256 folderId) internal {
        uint256 idx = userFolderIndex[user][folderId];
        uint256 lastIdx = userFolders[user].length - 1;
        uint256 lastId = userFolders[user][lastIdx];

        // Swap
        userFolders[user][idx] = lastId;
        userFolderIndex[user][lastId] = idx;

        // Pop
        userFolders[user].pop();

        // Clean up
        delete userFolderIndex[user][folderId];
    }

    function _removeFolderMember(uint256 folderId, address member) internal {
        Folder storage f = folders[folderId];
        uint256 idx = folderMemberIndex[folderId][member];
        uint256 lastIdx = f.members.length - 1;
        address lastMem = f.members[lastIdx];

        // Swap
        f.members[idx] = lastMem;
        folderMemberIndex[folderId][lastMem] = idx;

        // Pop
        f.members.pop();

        // Clean up
        delete folderMemberIndex[folderId][member];
    }

    function deleteFolder(uint256 folderId) public {
        Folder storage f = folders[folderId];
        if (msg.sender != f.folderOwner) revert OnlyFolderOwner();

        // Remove all files
        uint256[] storage fileIds = folderFiles[folderId];
        for (uint i = 0; i < fileIds.length; i++) {
            delete files[folderId][fileIds[i]];
        }
        delete folderFiles[folderId];

        address[] memory membersSnapshot = f.members;

        for (uint i = 0; i < membersSnapshot.length; i++) {
            address m = membersSnapshot[i];
            // O(1) remove from userFolders
            _removeUserFolder(m, folderId);

            // O(1) remove from Folder.members
            _removeFolderMember(folderId, m);

            // clean up per-member mappings
            delete permissions[folderId][m];
            delete f.encryptedFolderKey[m];
            f.isMember[m] = false;
        }

        delete folders[folderId];
    }

    /// @notice Upload a personal file (no folder required)
    function uploadPersonalFile(
        string calldata fileName,
        string calldata cid
    ) external returns (uint256) {
        uint256 fid = personalFileCount[msg.sender]++;
        personalFiles[msg.sender][fid] = File(msg.sender, fileName, cid, true);
        personalFileIds[msg.sender].push(fid);
        return fid;
    }

    /// @notice Delete a personal file
    function deletePersonalFile(uint256 fileId) external {
        File storage fe = personalFiles[msg.sender][fileId];
        if (!fe.available) revert FileNotAvailable();
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
    function getPersonalFile(
        uint256 fileId
    ) external view returns (string memory fileName, string memory cid) {
        File storage fe = personalFiles[msg.sender][fileId];
        if (!fe.available) revert FileNotAvailable();
        return (fe.fileName, fe.cid);
    }

    function registerEncryptionKey(string calldata pubKey) external {
        encryptionKeys[msg.sender] = pubKey;
    }

    function getEncryptionKeys(
        address[] calldata users
    ) external view returns (string[] memory keys) {
        uint256 len = users.length;
        keys = new string[](len);

        for (uint256 i = 0; i < len; i++) {
            // If a user hasn’t registered their key, return empty string.
            keys[i] = encryptionKeys[users[i]];
        }
    }

    function deleteMyAccount() external {
        address user = msg.sender;
        uint256[] storage foldersOfUser = userFolders[user];

        for (uint i = foldersOfUser.length; i > 0; i--) {
            uint256 folderId = foldersOfUser[i - 1];
            if (folders[folderId].folderOwner == user) {
                deleteFolder(folderId);
            } else {
                leaveFolder(folderId);
            }
        }

        delete userFolders[user];

        // Delete personal files
        uint256[] storage pFileIds = personalFileIds[user];
        for (uint i = 0; i < pFileIds.length; i++) {
            delete personalFiles[user][pFileIds[i]];
        }
        delete personalFileIds[user];
        delete personalFileCount[user];

        // Delete key
        delete encryptionKeys[user];
    }
}
