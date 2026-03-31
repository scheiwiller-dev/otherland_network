// types.mo - Shared types for Otherland Network
// Import this in both cardinal.mo and user_node.mo to avoid duplication

import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Float "mo:base/Float";

module {

  public type Position = (Float, Float, Float);
  public type Size     = (Float, Float, Float);
  public type Scale    = (Float, Float, Float);

  public type KhetMetadata = {
    khetId         : Text;
    khetType       : Text;
    gltfDataSize   : Nat;
    gltfDataRef    : ?(Principal, Text, Nat); // (storageCanisterId, blobId, size)
    position       : Position;
    originalSize   : Size;
    scale          : Scale;
    textures       : ?[(Text, Blob)];
    animations     : ?[Text];
    code           : ?Text;
    hash           : Text;
  };

  // Extended types for permissions and status
  public type NodeStatus = {
    canisterId : Principal;
    isPublic   : Bool;
    cycles     : Nat;
  };

  public type PlayerData = {
    principal         : Principal;
    position          : Position;
    signalingMessages : [(Principal, Text)];
    lastUpdate        : Int;
  };

  public type Message = {
    sender    : Text;
    text      : Text;
    timestamp : Int;
  };

  public type AuditLogEntry = {
    timestamp : Int;
    user      : Principal;
    action    : Text;
    details   : Text;
  };

  public type Invitation = {
    inviter    : Principal;
    expiration : Int;
  };

};