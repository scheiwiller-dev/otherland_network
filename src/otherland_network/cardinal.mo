import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Cycles "mo:base/ExperimentalCycles";
import _Error "mo:base/Error";
import Blob "mo:base/Blob";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Buffer "mo:base/Buffer";
import Array "mo:base/Array";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Time "mo:base/Time";
import Debug "mo:base/Debug";

import Types "types";

persistent actor Cardinal {

  // Types
  type Position     = Types.Position;
  type Size         = Types.Size;
  type Scale        = Types.Scale;
  type KhetMetadata = Types.KhetMetadata;
  type PlayerData   = Types.PlayerData;
  type Message      = Types.Message;
  type NodeStatus   = Types.NodeStatus;
  type Invitation    = Types.Invitation;
  type AuditLogEntry  = Types.AuditLogEntry;

  // Stable variables for raw data
  var _adminPrincipal : Principal = Principal.fromText("fxhz4-w423j-q2chq-mcdn2-ihrcb-egwai-7eoh5-x4y76-3zzsk-4loyy-fqe");
  var registryEntries : [(Principal, Principal)] = [];
  var wasmModule : ?Blob = null;
  var isWasmReady : Bool = false;
  var accessControlEntries : [(Principal, [(Principal, ())])] = [];
  var friendListsEntries : [(Principal, [Principal])] = [];
  var invitationsEntries : [(Text, Invitation)] = [];
  var invitationCounter : Nat = 0;
  var nodeVisibilityEntries : [(Principal, Bool)] = [];
  var blockedUsersEntries : [(Principal, ())] = [];
  var auditLogEntries : [Types.AuditLogEntry] = [];

  // In-memory HashMaps reconstructed from stable data
  transient var registry = HashMap.fromIter<Principal, Principal>(
    registryEntries.vals(),
    10,
    Principal.equal,
    Principal.hash
  );
  transient var accessControl = HashMap.fromIter<Principal, HashMap.HashMap<Principal, ()>>(
    Iter.map<(Principal, [(Principal, ())]), (Principal, HashMap.HashMap<Principal, ()>)>(
      accessControlEntries.vals(),
      func((user, allowedList)) {
        (user, HashMap.fromIter<Principal, ()>(allowedList.vals(), 10, Principal.equal, Principal.hash))
      }
    ),
    10,
    Principal.equal,
    Principal.hash
  );
  transient var friendLists = HashMap.fromIter<Principal, [Principal]>(
    friendListsEntries.vals(),
    10,
    Principal.equal,
    Principal.hash
  );
  transient var invitations = HashMap.fromIter<Text, Invitation>(
      invitationsEntries.vals(),
      10,
      Text.equal,
      Text.hash
  );
  transient var nodeVisibility = HashMap.fromIter<Principal, Bool>(
    nodeVisibilityEntries.vals(),
    10,
    Principal.equal,
    Principal.hash
  );
  transient var blockedUsers = HashMap.fromIter<Principal, ()>(
    blockedUsersEntries.vals(), 10, Principal.equal, Principal.hash
  );
  transient var auditLog = Buffer.Buffer<Types.AuditLogEntry>(50);
  
  // Upgrade hooks to save and restore HashMap data
  system func preupgrade() {
    registryEntries := Iter.toArray(registry.entries());
    accessControlEntries := Iter.toArray(
      Iter.map<(Principal, HashMap.HashMap<Principal, ()>), (Principal, [(Principal, ())])>(
        accessControl.entries(),
        func((user, allowedMap)) {
          (user, Iter.toArray(allowedMap.entries()))
        }
      )
    );
    friendListsEntries := Iter.toArray(friendLists.entries());
    invitationsEntries := Iter.toArray(invitations.entries());
    nodeVisibilityEntries := Iter.toArray(nodeVisibility.entries());
    blockedUsersEntries := Iter.toArray(
      Iter.map<Principal, (Principal, ())>(blockedUsers.keys(), func(p : Principal) : (Principal, ()) {
        (p, ())
      })
    );
    auditLogEntries := Iter.toArray(auditLog.vals());
  };

  system func postupgrade() {
    registry := HashMap.fromIter<Principal, Principal>(
      registryEntries.vals(),
      10,
      Principal.equal,
      Principal.hash
    );
    accessControl := HashMap.fromIter<Principal, HashMap.HashMap<Principal, ()>>(
      Iter.map<(Principal, [(Principal, ())]), (Principal, HashMap.HashMap<Principal, ()>)>(
        accessControlEntries.vals(),
        func((user, allowedList)) {
          (user, HashMap.fromIter<Principal, ()>(allowedList.vals(), 10, Principal.equal, Principal.hash))
        }
      ),
      10,
      Principal.equal,
      Principal.hash
    );
    friendLists := HashMap.fromIter<Principal, [Principal]>(
      friendListsEntries.vals(),
      10,
      Principal.equal,
      Principal.hash
    );
    invitations := HashMap.fromIter<Text, Invitation>(
        invitationsEntries.vals(),
        10,
        Text.equal,
        Text.hash
    );
    nodeVisibility := HashMap.fromIter<Principal, Bool>(
      nodeVisibilityEntries.vals(),
      10,
      Principal.equal,
      Principal.hash
    );
    blockedUsers := HashMap.fromIter<Principal, ()>(
      blockedUsersEntries.vals(), 
      10, 
      Principal.equal, 
      Principal.hash
    );
    auditLog := Buffer.fromIter<AuditLogEntry>(auditLogEntries.vals());
  };

  // NEW: Admin functions
  public shared({ caller }) func setAdmin(newAdmin: Principal) : async () {
    if (caller != _adminPrincipal) return;
    _adminPrincipal := newAdmin;
    _logAudit(caller, "setAdmin", "New admin set");
  };

  public shared({ caller }) func getAllRegisteredUsers() : async [(Principal, Principal)] {  // user -> node canister
    if (caller != _adminPrincipal) return [];
    Iter.toArray(registry.entries());
  };

  public shared({ caller }) func getNodeStatus(user: Principal) : async ?Types.NodeStatus {
    if (caller != _adminPrincipal and caller != user) return null;
    switch (registry.get(user)) {
      case (?canisterId) {
        let isPublic = Option.get(nodeVisibility.get(user), false);
        let nodeActor = actor(Principal.toText(canisterId)) : actor { getCyclesBalance : () -> async Nat };
        let cycles = try { await nodeActor.getCyclesBalance() } catch (_) { 0 };
        ?{ canisterId; isPublic; cycles };
      };
      case null { null };
    };
  };

  public shared({ caller }) func topUpNodeCycles(user: Principal, amount: Nat) : async () {
    if (caller != _adminPrincipal) return;
    switch (registry.get(user)) {
      case (?canisterId) {
        Cycles.add(amount);
        let _ = await (actor(Principal.toText(canisterId)) : actor { acceptCycles : () -> async () }).acceptCycles();
        _logAudit(caller, "topUpNodeCycles", "Topped up " # Nat.toText(amount) # " for " # Principal.toText(user));
      };
      case null {};
    };
  };

  public shared({ caller }) func blockUser(user: Principal, block: Bool) : async () {
    if (caller != _adminPrincipal) return;
    if (block) {
      blockedUsers.put(user, ());
    } else {
      blockedUsers.delete(user);
    };
    _logAudit(caller, "blockUser", Principal.toText(user) # " blocked=" # debug_show(block));
  };

  public query func isBlocked(user: Principal) : async Bool {
    Option.isSome(blockedUsers.get(user));
  };

  // Friend helper (cross-cutting recommendation)
  public query func isFriendWith(userA: Principal, userB: Principal) : async Bool {
    switch (friendLists.get(userA)) {
      case (?friends) { Array.find(friends, func(f: Principal) : Bool { f == userB }) != null };
      case null { false };
    };
  };

  // Friend List Management
  public shared({ caller }) func addFriend(friend : Principal) : async () {
    if (caller == friend) return; // Prevent adding self
    switch (friendLists.get(caller)) {
      case (?friends) {
        let existing = Array.find<Principal>(friends, func(f) { f == friend });
        if (existing == null) {
          let newFriends = Array.append(friends, [friend]);
          friendLists.put(caller, newFriends);
        };
      };
      case null {
        friendLists.put(caller, [friend]);
      };
    };
  };

  public shared({ caller }) func removeFriend(friend : Principal) : async () {
    switch (friendLists.get(caller)) {
      case (?friends) {
        let newFriends = Array.filter<Principal>(friends, func(f : Principal) : Bool { f != friend });
        friendLists.put(caller, newFriends);
      };
      case null {
        // No friends to remove
      };
    };
  };

  public query({ caller }) func getFriends() : async [Principal] {
    switch (friendLists.get(caller)) {
      case (?friends) { friends };
      case null { [] };
    };
  };
  
  // Generate a friend invitation
  public shared({ caller }) func generateFriendInvitation() : async Text {
      let token = Nat.toText(invitationCounter) # "-" # Int.toText(Time.now());
      invitationCounter += 1;
      let expiration = Time.now() + 7 * 24 * 3600 * 1_000_000_000; // 7 days in nanoseconds
      invitations.put(token, { inviter = caller; expiration });
      return token;
  };

  // Accept a friend invitation
  public shared({ caller }) func acceptFriendInvitation(token: Text) : async Result.Result<(), Text> {
      switch (invitations.get(token)) {
          case (null) { return #err("Invalid token") };
          case (?invitation) {
              if (Time.now() > invitation.expiration) {
                  invitations.delete(token);
                  return #err("Invitation expired");
              };
              // Add to each other's friend lists
              switch (friendLists.get(invitation.inviter)) {
                  case (?friends) {
                      let existing = Array.find<Principal>(friends, func(f) { f == caller });
                      if (existing == null) {
                          friendLists.put(invitation.inviter, Array.append(friends, [caller]));
                      };
                  };
                  case null {
                      friendLists.put(invitation.inviter, [caller]);
                  };
              };
              switch (friendLists.get(caller)) {
                  case (?friends) {
                      let existing = Array.find<Principal>(friends, func(f) { f == invitation.inviter });
                      if (existing == null) {
                          friendLists.put(caller, Array.append(friends, [invitation.inviter]));
                      };
                  };
                  case null {
                      friendLists.put(caller, [invitation.inviter]);
                  };
              };
              invitations.delete(token);
              return #ok(());
          };
      };
  };

  // NEW: cancelInvitation and getPendingInvitations
  public shared({ caller }) func cancelInvitation(token: Text) : async Result.Result<(), Text> {
    switch (invitations.get(token)) {
      case (?inv) {
        if (inv.inviter == caller) {
          invitations.delete(token);
          return #ok(());
        } else { return #err("Not the inviter"); };
      };
      case null { #err("Invalid token"); };
    };
  };

  public query({ caller }) func getPendingInvitations() : async [(Text, Invitation)] {
    Iter.toArray(Iter.filter(invitations.entries(), func((_, inv): (Text, Invitation)) : Bool {
      inv.inviter == caller
    }));
  };

  // Internal helper
  private func _logAudit(user: Principal, action: Text, details: Text) {
    auditLog.add({ timestamp = Time.now(); user; action; details });
    if (auditLog.size() > 50) { ignore auditLog.remove(0); };
  };

  // Node Visibility Management
  public shared({ caller }) func setNodeVisibility(isPublic : Bool) : async () {
    switch (registry.get(caller)) {
      case (?_canisterId) {
        nodeVisibility.put(caller, isPublic);
      };
      case null {
        // No canister for this user
      };
    };
  };

  public query({ caller }) func getNodeVisibility() : async ?Bool {
    nodeVisibility.get(caller);
  };

  // Get Allowed Users
  public query({ caller }) func getAllowedUsers() : async [Principal] {
    switch (accessControl.get(caller)) {
      case (?allowedMap) {
        Iter.toArray(allowedMap.keys())
      };
      case null { [] };
    };
  };

  // Get List of all Canisters with Access
  public query({ caller }) func getAccessibleCanisters() : async [(Principal, Principal, Bool)] {
    let buf = Buffer.Buffer<(Principal, Principal, Bool)>(0);
    for ((owner, canisterId) in registry.entries()) {
      let isPublic = switch (nodeVisibility.get(owner)) {
        case (?val) { val };
        case null { false };
      };
      if (isPublic or caller == owner) {
        buf.add((canisterId, owner, isPublic));
      } else {
        switch (accessControl.get(owner)) {
          case (?allowedMap) {
            if (Option.isSome(allowedMap.get(caller))) {
              buf.add((canisterId, owner, isPublic));
            }
          };
          case null {
            // No access control entry
          };
        }
      }
    };
    return Buffer.toArray(buf);
  };

  // Request a new canister
  public shared({ caller }) func requestCanister() : async Result.Result<Principal, Text> {
    if (not isWasmReady) {
      return #err("WASM module is not ready or is being updated. Please try again later.");
    };

    // Cap User canisters at 1 (remove if unwanted)
    switch (registry.get(caller)) {
      case (?canisterId) {
        return #ok(canisterId); // Return existing canister ID
      };
      case null {

        // Guard against cardinal running out of cycles
        // We keep a 2.5x margin on the measured consumption (~2T)
        if (Cycles.balance() < 5_100_000_000_000) {
          return #err("Cardinal canister has insufficient cycles. Top it up with: dfx ledger fabricate-cycles --all");
        };

        Debug.print("=== requestCanister start - balance: " # Nat.toText(Cycles.balance()));

        // Create a new canister with initial cycle funding
        let ic = actor("aaaaa-aa") : actor {                                                               // Placeholder admin principal
          create_canister : <system> () -> async { canister_id : Principal };
          install_code : <system>({ canister_id : Principal; wasm_module : Blob; arg : Blob; mode : { #install } }) -> async ();
        };

        // 2.5x margin applied to measured usage
        let { canister_id } = await (with cycles = 1_300_000_000_000) ic.create_canister();  // ~1.3T (was 2T)

        Debug.print("create_canister done - balance now: " # Nat.toText(Cycles.balance()));

        // Install the WASM module
        switch (wasmModule) {
          case (?wasmModuleBlob) {
            // 2.5x margin for install + buffer for the init call
            await (with cycles = 650_000_000_000) ic.install_code({
              canister_id;
              wasm_module = wasmModuleBlob;
              arg = Blob.fromArray([]); // Empty args
              mode = #install;
            });
            Debug.print("install_code done - balance now: " # Nat.toText(Cycles.balance()));
          };
          case null {
            return #err("WASM module not available.");
          };
        };

        // Initialize the user canister with the owner
        let userCanister = actor(Principal.toText(canister_id)) : actor {
          init : (Principal) -> async ();
        };
        // Extra cycles for the init call (small but safe)
        await (with cycles = 100_000_000_000) userCanister.init(caller);
        Debug.print("init done - balance now: " # Nat.toText(Cycles.balance()));

        // Register the canister and set up access control
        registry.put(caller, canister_id);
        nodeVisibility.put(caller, false); // Default to private
        let allowedMap = HashMap.HashMap<Principal, ()>(10, Principal.equal, Principal.hash);
        allowedMap.put(caller, ()); // Owner is always allowed
        accessControl.put(caller, allowedMap);
        Debug.print("=== requestCanister finished successfully");
        return #ok(canister_id);
      };
    };
  };

  // Get canister ID if the caller is authorized
  public query({ caller }) func getCanisterId(user : Principal) : async ?Principal {
    switch (accessControl.get(user)) {
      case (?allowedMap) {
        if (Option.isSome(allowedMap.get(caller))) {
          return registry.get(user);
        } else {
          return null;
        };
      };
      case null {
        return null;
      };
    };
  };

  // Add user to allowed list for a node
  public shared({ caller }) func addAllowedUser(nodeId: Principal, user: Principal) : async Result.Result<(), Text> {
      switch (registry.get(caller)) {
          case (?ownedNodeId) {
              if (ownedNodeId != nodeId) {
                  return #err("Not the owner of this node");
              };
              switch (accessControl.get(caller)) {
                  case (?allowedMap) {
                      allowedMap.put(user, ());
                  };
                  case null {
                      let newMap = HashMap.HashMap<Principal, ()>(10, Principal.equal, Principal.hash);
                      newMap.put(user, ());
                      accessControl.put(caller, newMap);
                  };
              };
              // Update the user node canister
              let userNodeActor = actor(Principal.toText(nodeId)) : actor {
                  addReader : (Principal) -> async ();
              };
              await userNodeActor.addReader(user);
              return #ok(());
          };
          case null {
              return #err("No node found for this user");
          };
      };
  };

  // Remove an allowed principal (only callable by the owner)
  public shared({ caller }) func removeAllowed(allowed : Principal) : async Result.Result<(), Text> {
    switch (accessControl.get(caller)) {
      case (?allowedMap) {
        allowedMap.delete(allowed);
        return #ok(());
      };
      case null {
        return #err("No canister found for this user.");
      };
    };
  };

  // Upload WASM module (restricted to an admin principal for simplicity)
  public shared({ caller = _ }) func uploadWasmModule(wasmModuleBlob : Blob) : async () {
    // Replace with your admin principal in production
    //assert(caller == adminPrincipal);  // Placeholder admin principal
    isWasmReady := false; // Mark as not ready during upload
    wasmModule := ?wasmModuleBlob;
    isWasmReady := true; // Mark as ready after upload completes
  };

  // Upgrade the user's canister with the current WASM module
  public shared({ caller }) func upgradeCanister() : async Result.Result<(), Text> {
    switch (registry.get(caller)) {
      case (?canisterId) {
        switch (wasmModule) {
          case (?wasmModuleBlob) {
            let ic = actor("aaaaa-aa") : actor {
              install_code : <system>({ canister_id : Principal; wasm_module : Blob; arg : Blob; mode : { #upgrade } }) -> async ();
            };
            await ic.install_code({
              canister_id = canisterId;
              wasm_module = wasmModuleBlob;
              arg = Blob.fromArray([]); // Empty args
              mode = #upgrade;
            });
            return #ok(());
          };
          case null {
            return #err("WASM module not available.");
          };
        };
      };
      case null {
        return #err("No canister found for this user.");
      };
    };
  };
};