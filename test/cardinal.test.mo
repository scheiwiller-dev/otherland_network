import Test "mo:test";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Types "../src/otherland_network/types";

Test.suite("Cardinal Canister Tests", func() {

  Test.test("Types - should define Position type", func() {
    let position : Types.Position = (1.0, 2.0, 3.0);
    assert true;
  });

  Test.test("Types - should define Size type", func() {
    let size : Types.Size = (10.0, 20.0, 30.0);
    assert true;
  });

  Test.test("Types - should define Scale type", func() {
    let scale : Types.Scale = (0.5, 0.5, 0.5);
    assert true;
  });

  Test.test("Types - should create KhetMetadata", func() {
    let khet : Types.KhetMetadata = {
      khetId = "test-khet";
      khetType = "scene-object";
      gltfDataSize = 1024;
      gltfDataRef = null;
      position = (0.0, 0.0, 0.0);
      originalSize = (1.0, 1.0, 1.0);
      scale = (1.0, 1.0, 1.0);
      textures = null;
      animations = null;
      code = null;
      hash = "test-hash";
    };
    assert (khet.khetId == "test-khet");
  });

  Test.test("Types - should create NodeStatus", func() {
    let status : Types.NodeStatus = {
      canisterId = Principal.fromText("aaaaa-aa");
      isPublic = true;
      cycles = 1000000;
    };
    assert (status.isPublic == true);
  });

  Test.test("Principal operations - should work with principals", func() {
    let p1 = Principal.fromText("aaaaa-aa");
    let p2 = Principal.fromText("aaaaa-aa");
    assert (Principal.equal(p1, p2));
  });

  Test.test("Text operations - should handle text", func() {
    let greeting = "Hello Otherland!";
    assert (Text.size(greeting) > 0);
  });

});