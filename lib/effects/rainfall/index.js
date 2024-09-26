"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.DefaultOptions = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _arrays = require("../../utils/arrays");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          Copyright 2020 - 2023 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          Copyright 2021 Josias Allestad
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
const DefaultOptions = {
  maxCount: 600,
  speed: 12
};
exports.DefaultOptions = DefaultOptions;
const KEY_FRAME_INTERVAL = 15;
class Rainfall {
  constructor(options) {
    var _this = this;
    (0, _defineProperty2.default)(this, "options", void 0);
    (0, _defineProperty2.default)(this, "context", null);
    (0, _defineProperty2.default)(this, "particles", []);
    (0, _defineProperty2.default)(this, "lastAnimationTime", 0);
    (0, _defineProperty2.default)(this, "isRunning", false);
    (0, _defineProperty2.default)(this, "start", async function (canvas) {
      let timeout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3000;
      if (!canvas) {
        return;
      }
      _this.context = canvas.getContext("2d");
      _this.particles = [];
      const count = _this.options.maxCount;
      while (_this.particles.length < count) {
        _this.particles.push(_this.resetParticle({}, canvas.width, canvas.height));
      }
      _this.isRunning = true;
      requestAnimationFrame(_this.renderLoop);
      if (timeout) {
        window.setTimeout(_this.stop, timeout);
      }
    });
    (0, _defineProperty2.default)(this, "stop", async () => {
      this.isRunning = false;
    });
    (0, _defineProperty2.default)(this, "resetParticle", (particle, width, height) => {
      particle.x = Math.random() * width;
      particle.y = Math.random() * -height;
      particle.width = Math.random() * 1.5;
      particle.height = particle.width * 15 + 4;
      particle.speed = Math.random() * this.options.speed * 4 / 5 + this.options.speed;
      return particle;
    });
    (0, _defineProperty2.default)(this, "renderLoop", () => {
      if (!this.context || !this.context.canvas) {
        return;
      }
      if (this.particles.length === 0) {
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
      } else {
        const timeDelta = Date.now() - this.lastAnimationTime;
        if (timeDelta >= KEY_FRAME_INTERVAL || !this.lastAnimationTime) {
          // Clear the screen first
          this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
          this.lastAnimationTime = Date.now();
          this.animateAndRenderRaindrops();
        }
        requestAnimationFrame(this.renderLoop);
      }
    });
    (0, _defineProperty2.default)(this, "animateAndRenderRaindrops", () => {
      if (!this.context || !this.context.canvas) {
        return;
      }
      const height = this.context.canvas.height;
      for (const particle of (0, _arrays.arrayFastClone)(this.particles)) {
        particle.y += particle.speed;
        this.context.save();
        this.context.beginPath();
        this.context.rect(particle.x, particle.y, particle.width, particle.height);
        this.context.fillStyle = "#5dadec"; // light blue
        this.context.fill();
        this.context.closePath();
        this.context.restore();

        // Remove dead raindrops
        const maxBounds = height * 2;
        if (particle.y > height + maxBounds) {
          const idx = this.particles.indexOf(particle);
          this.particles.splice(idx, 1);
        }
      }
    });
    this.options = _objectSpread(_objectSpread({}, DefaultOptions), options);
  }
}
exports.default = Rainfall;
//# sourceMappingURL=index.js.map