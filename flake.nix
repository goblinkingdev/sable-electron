{
  description = "Sable Desktop — unofficial Electron wrapper for Sable Matrix client";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        electronLibs = with pkgs; [
          glib
          nss
          nspr
          atk
          at-spi2-atk
          at-spi2-core
          cups
          dbus
          expat
          libdrm
          pango
          cairo
          gtk3
          gdk-pixbuf
          mesa
          libgbm
          vulkan-loader
          libGL
          wayland
          libxkbcommon
          alsa-lib
          libsecret
          udev
          libx11
          libxcomposite
          libxdamage
          libxext
          libxfixes
          libxrandr
          libxcb
          libxshmfence
          libxscrnsaver
        ];

        devShell = pkgs.mkShell {
          packages =
            with pkgs;
            [
              nodejs_24
              pnpm
              git
              patchelf
              rpm
              dpkg
              fakeroot
            ]
            ++ electronLibs;

          shellHook = ''
            ELECTRON_BIN="$PWD/node_modules/electron/dist/electron"
            INTERP="${pkgs.stdenv.cc.bintools.dynamicLinker}"
            if [ -f "$ELECTRON_BIN" ] && [ -x "$ELECTRON_BIN" ]; then
              current="$(patchelf --print-interpreter "$ELECTRON_BIN" 2>/dev/null || true)"
              if [ "$current" != "$INTERP" ]; then
                echo "[sable-desktop] patching electron ELF interpreter..."
                patchelf --set-interpreter "$INTERP" "$ELECTRON_BIN"
                echo "[sable-desktop] done."
              fi
            else
              echo "[sable-desktop] electron binary not found — run: npm install"
            fi
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath electronLibs}:/run/opengl-driver/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
          '';
        };

        sableSrc = pkgs.fetchFromGitHub {
          owner = "SableClient";
          repo = "Sable";
          rev = "v1.18.3";
          hash = "sha256-yi70WBH0lDw1h4Oy6NNfi71kp32be3rtZDt3/C2e524="; 
        };

        sableSrcPatched = pkgs.runCommand "sable-src-patched" {
          buildInputs = [ pkgs.jq ];
        } ''
          cp -r ${sableSrc} $out
          chmod -R +w $out

          # Remove old-style pnpm config from package.json (pnpm 11 ignores it anyway)
          ${pkgs.jq}/bin/jq 'del(.pnpm)' $out/package.json > $out/package.json.tmp
          mv $out/package.json.tmp $out/package.json

          # Sync overrides to match what's in the lockfile (jsdom>undici only).
          # The upstream pnpm-workspace.yaml has 8 overrides that don't match the lockfile,
          # causing pnpm --frozen-lockfile to fail with LOCKFILE_CONFIG_MISMATCH.
          cat > $out/pnpm-workspace.yaml << 'YAMLEOF'
allowBuilds:
  '@sentry/cli': true
  '@swc/core': true
  cloudflared: true
  esbuild: true
  sharp: true
  unrs-resolver: true
  workerd: true
engineStrict: true
minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  - '@sableclient/sable-call-embedded'
  - '@sableclient/twemoji-font'

overrides:
  jsdom>undici: '^7.28.0'

peerDependencyRules:
  allowedVersions:
    'folds>@vanilla-extract/css': '1.18.0'
    'folds>@vanilla-extract/recipes': '0.5.7'
    'folds>classnames': '2.5.1'
    'folds>react': '18.3.1'
    'folds>react-dom': '18.3.1'
YAMLEOF
        '';

        sableWebApp = pkgs.stdenv.mkDerivation {
          pname = "sable-webapp";
          version = "dev";
          src = sableSrcPatched;

          nativeBuildInputs = with pkgs; [
            nodejs_24
            pnpm
            pnpmConfigHook
          ];

          pnpmDeps = pkgs.fetchPnpmDeps {
            pname = "sable-webapp";
            version = "dev";
            src = sableSrcPatched;
            fetcherVersion = 3;
            hash = "sha256-aAPKakgGzuSHsu7lc1XJ6eyudodgWbqPR7PhL4lLqVw=";
          };

          buildPhase = "runHook preBuild; NODE_OPTIONS='--max-old-space-size=8192' pnpm build; runHook postBuild";
          installPhase = "runHook preInstall; cp -r dist $out; runHook postInstall";
        };

        sableDesktop = pkgs.buildNpmPackage {
          pname = "sable-desktop";
          version = "1.0.5-1.18.3";
          src = self;

          npmDepsHash = "sha256-x+QLU5byWDDO5ATyGlNRuRgnA07zF9SMrJn83DAqmW8="; 

          nativeBuildInputs = with pkgs; [
            nodejs_24
            makeWrapper
            electron
          ];
          buildInputs = electronLibs;

          env = {
            ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
            ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron}/libexec/electron";
          };

          buildPhase = ''
            runHook preBuild
            mkdir -p sable
            cp -r ${sableWebApp} sable/dist
            npm run build:electron
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/lib/sable-desktop $out/bin
            cp -r dist-electron package.json $out/lib/sable-desktop/
	    cp -r node_modules $out/lib/sable-desktop/node_modules
            cp -r ${sableWebApp} $out/lib/sable-desktop/dist 
	    makeWrapper ${pkgs.electron}/bin/electron $out/bin/sable-desktop \
              --add-flags "$out/lib/sable-desktop" \
              --set LD_LIBRARY_PATH "${pkgs.lib.makeLibraryPath electronLibs}:/run/opengl-driver/lib"
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Unofficial Electron desktop wrapper for Sable Matrix client";
            homepage = "https://github.com/GoblinKingDev/sable-electron";
            license = licenses.agpl3Only;
            platforms = platforms.linux ++ platforms.darwin;
            mainProgram = "sable-desktop";
          };
        };

      in
      {
        devShells.default = devShell;
        packages.default = sableDesktop;
        packages.sable-webapp = sableWebApp;
        packages.sable-desktop = sableDesktop;
      }
    );
}
