{
  description = "Shard - Fragments of Memory character tracker";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, rust-overlay }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system:
        f (import nixpkgs {
          inherit system;
          overlays = [ (import rust-overlay) ];
        }));
    in {
      devShells = forAllSystems (pkgs:
        let
          rust = pkgs.rust-bin.stable.latest.default.override {
            targets = [ "wasm32-unknown-unknown" ];
            extensions = [ "rust-src" "rustfmt" "clippy" ];
          };
        in {
          default = pkgs.mkShell {
            packages = [
              rust
              pkgs.dioxus-cli
              pkgs.wasm-bindgen-cli
              pkgs.binaryen
              pkgs.pkg-config
              pkgs.openssl
            ];
            shellHook = ''
              echo "Shard devshell"
              echo "  cargo test --no-default-features --lib --tests"
              echo "  dx serve --platform web"
            '';
          };
        });

      formatter = forAllSystems (pkgs: pkgs.nixfmt-rfc-style);
    };
}
