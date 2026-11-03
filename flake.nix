{
  description = "Shard - Fragments of Memory character tracker";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system:
        f (import nixpkgs {
          inherit system;
        }));
    in {
      devShells = forAllSystems (pkgs:
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_24
            ];
            shellHook = ''
              echo "Shard devshell (Vite + React + TypeScript)"
              echo "  npm install   # first run (npm approves the esbuild script)"
              echo "  npm test      # domain/config tests (vitest)"
              echo "  npm run dev   # live preview with HMR under /sfom-character-sheet/"
              echo "  npm run build # production PWA bundle in dist/"
            '';
          };
        });

      formatter = forAllSystems (pkgs: pkgs.nixfmt-rfc-style);
    };
}
