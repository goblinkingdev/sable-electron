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
          rev = "v1.17.0";
          hash = "sha256-hWh/xfyuEQTjqf/k5HJ32wFdOHRWXWqAh6q1pdk4Ih4="; 
        };

        sableWebApp = pkgs.stdenv.mkDerivation {
          pname = "sable-webapp";
          version = "dev";
          src = sableSrc;

          nativeBuildInputs = with pkgs; [
            nodejs_24
            pnpm
            pnpmConfigHook
          ];

          pnpmDeps = pkgs.fetchPnpmDeps {
            pname = "sable-webapp";
            version = "dev";
            src = sableSrc;
            fetcherVersion = 3;
            hash = "sha256-DlWFD0AJp/KD15SU8/1L0RAj7J+66zY8hwiu19AlO0I=";
          };

          buildPhase = "runHook preBuild; pnpm build; runHook postBuild";
          installPhase = "runHook preInstall; cp -r dist $out; runHook postInstall";
        };

        sableDesktop = pkgs.buildNpmPackage {
          pname = "sable-desktop";
          version = "1.0.5-1.17.0";
          src = self;

          npmDepsHash = "sha256-SFAPzyofklcG/eAxuHIY2wV5P3FqJd1kFx/E8e2DpSA="; 

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
