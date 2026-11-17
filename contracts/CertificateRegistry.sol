// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CertificateRegistry
/// @notice Issue, verify and revoke academic certificates by unique ID.
/// @dev Only the issuer (deployer, transferable) may issue/revoke. All rules are enforced on-chain.
contract CertificateRegistry {
    struct Certificate {
        string id;
        address recipient;
        bytes32 docHash;
        uint64 issuedAt;
        uint64 revokedAt; // 0 while not revoked
        bool exists;
        bool revoked;
    }

    address public issuer;
    uint256 public totalIssued;
    mapping(bytes32 => Certificate) private certs; // key = keccak256(bytes(id))

    event CertificateIssued(string indexed idIndexed, string id, address indexed recipient, bytes32 docHash, uint64 issuedAt);
    event CertificateRevoked(string indexed idIndexed, string id, address indexed revokedBy, uint64 revokedAt);
    event IssuerTransferred(address indexed oldIssuer, address indexed newIssuer);

    error NotIssuer(address caller);
    error EmptyId();
    error ZeroRecipient();
    error EmptyHash();
    error DuplicateId(string id);
    error UnknownId(string id);
    error AlreadyRevoked(string id);
    error ZeroAddress();

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer(msg.sender);
        _;
    }

    constructor() {
        issuer = msg.sender;
        emit IssuerTransferred(address(0), msg.sender);
    }

    function issue(string calldata id, address recipient, bytes32 docHash) external onlyIssuer {
        if (bytes(id).length == 0) revert EmptyId();
        if (recipient == address(0)) revert ZeroRecipient();
        if (docHash == bytes32(0)) revert EmptyHash();
        bytes32 key = keccak256(bytes(id));
        if (certs[key].exists) revert DuplicateId(id);

        certs[key] = Certificate(id, recipient, docHash, uint64(block.timestamp), 0, true, false);
        totalIssued += 1;
        emit CertificateIssued(id, id, recipient, docHash, uint64(block.timestamp));
    }

    function revoke(string calldata id) external onlyIssuer {
        bytes32 key = keccak256(bytes(id));
        Certificate storage c = certs[key];
        if (!c.exists) revert UnknownId(id);
        if (c.revoked) revert AlreadyRevoked(id);
        c.revoked = true;
        c.revokedAt = uint64(block.timestamp);
        emit CertificateRevoked(id, id, msg.sender, uint64(block.timestamp));
    }

    function transferIssuer(address newIssuer) external onlyIssuer {
        if (newIssuer == address(0)) revert ZeroAddress();
        emit IssuerTransferred(issuer, newIssuer);
        issuer = newIssuer;
    }

    /// @notice Current validity: exists and not revoked.
    function isValid(string calldata id) public view returns (bool) {
        Certificate storage c = certs[keccak256(bytes(id))];
        return c.exists && !c.revoked;
    }

    /// @notice Verify a document hash against the record.
    /// @return exists    certificate ID is registered
    /// @return hashMatch supplied hash equals the recorded hash
    /// @return valid     exists, hash matches and not revoked
    function verify(string calldata id, bytes32 docHash)
        external
        view
        returns (bool exists, bool hashMatch, bool valid)
    {
        Certificate storage c = certs[keccak256(bytes(id))];
        exists = c.exists;
        hashMatch = c.exists && c.docHash == docHash;
        valid = hashMatch && !c.revoked;
    }

    function getCertificate(string calldata id) external view returns (Certificate memory) {
        Certificate memory c = certs[keccak256(bytes(id))];
        if (!c.exists) revert UnknownId(id);
        return c;
    }
}
