# Runtime game config

These YAML files are served as static assets next to the app. They are loaded at runtime and are not compiled into the WebAssembly binary.

- Edit an existing YAML file and reload the app; no Rust rebuild is needed.
- Delete a file and remove its entry from `index.json`; no rebuild is needed.
- Add a YAML file and add its filename to the matching list in `index.json`; no rebuild is needed.

`index.json` exists because plain static web hosting cannot list directory contents. Native/mobile builds scan the entity directories directly and do not depend on the web index.
