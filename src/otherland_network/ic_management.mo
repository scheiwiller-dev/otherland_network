// Typed view of the IC management canister used by Cardinal
import Principal "mo:core/Principal";
import Blob "mo:core/Blob";

module {
  public type WasmMemoryPersistence = { #keep; #replace };

  public type UpgradeOptions = {
    skip_pre_upgrade : ?Bool;
    wasm_memory_persistence : ?WasmMemoryPersistence;
  };

  // `upgrade` carries options. Enhanced orthogonal persistence requires
  // `wasm_memory_persistence = keep` so the heap survives the upgrade.
  public type InstallMode = {
    #install;
    #reinstall;
    #upgrade : ?UpgradeOptions;
  };

  public type Service = actor {
    create_canister : <system> () -> async { canister_id : Principal };
    install_code : <system>({
      canister_id : Principal;
      wasm_module : Blob;
      arg : Blob;
      mode : InstallMode;
    }) -> async ();
  };

  public func management() : Service {
    actor ("aaaaa-aa") : Service
  };
}
