"use strict";

var _blurhash = require("blurhash");
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const ctx = self;
ctx.addEventListener("message", event => {
  const {
    seq,
    imageData
  } = event.data;
  const blurhash = (0, _blurhash.encode)(imageData.data, imageData.width, imageData.height,
  // use 4 components on the longer dimension, if square then both
  imageData.width >= imageData.height ? 4 : 3, imageData.height >= imageData.width ? 4 : 3);
  ctx.postMessage({
    seq,
    blurhash
  });
});
//# sourceMappingURL=blurhash.worker.js.map