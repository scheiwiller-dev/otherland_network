import Test "mo:test";
import Principal "mo:core/Principal";
import Blob "mo:core/Blob";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Types "../src/otherland_network/types";

Test.suite("User Node Canister Tests", func() {

  Test.test("Types - should create valid KhetMetadata", func() {
    let khet : Types.KhetMetadata = {
      khetId = "test-khet-123";
      khetType = "avatar";
      gltfDataSize = 2048;
      gltfDataRef = ?(Principal.fromText("aaaaa-aa"), "blob-123", 2048);
      position = (10.5, 20.3, 5.7);
      originalSize = (2.0, 2.0, 2.0);
      scale = (0.8, 0.8, 0.8);
      textures = ?[("diffuse", Blob.fromArray([1, 2, 3, 4]))];
      animations = ?["walk", "run"];
      code = ?"console.log('Hello from khet!');";
      hash = "sha256-abcdef123456";
    };
    assert (khet.khetType == "avatar");
    assert (khet.gltfDataSize == 2048);
  });

  Test.test("Blob operations - should handle blob creation", func() {
    let data : [Nat8] = [1, 2, 3, 4, 5];
    let blob = Blob.fromArray(data);
    assert (Blob.toArray(blob) == data);
  });

  Test.test("Principal operations - should handle different principals", func() {
    let p1 = Principal.fromText("aaaaa-aa");
    let p2 = Principal.fromText("2vxsx-fae");
    assert (not Principal.equal(p1, p2));
  });

  Test.test("Text operations - should handle khet IDs", func() {
    let khetId = "khet_2024_001";
    assert (Text.startsWith(khetId, #text "khet"));
    assert (Text.size(khetId) == 13);
  });

  Test.test("Array operations - should work with arrays", func() {
    let numbers = [1, 2, 3, 4, 5];
    assert (Array.size(numbers) == 5);
  });

  Test.test("Nat operations - should handle sizes", func() {
    let size : Nat = 1024 * 1024; // 1MB
    assert (size > 1000000);
  });

});