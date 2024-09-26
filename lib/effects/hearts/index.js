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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          Copyright 2022 Arseny Uskov
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
  maxCount: 120,
  gravity: 3.2,
  maxDrift: 5,
  maxRot: 5
};
exports.DefaultOptions = DefaultOptions;
const KEY_FRAME_INTERVAL = 15; // 15ms, roughly

class Hearts {
  constructor(options) {
    var _this = this;
    (0, _defineProperty2.default)(this, "options", void 0);
    (0, _defineProperty2.default)(this, "context", null);
    (0, _defineProperty2.default)(this, "particles", []);
    (0, _defineProperty2.default)(this, "lastAnimationTime", 0);
    (0, _defineProperty2.default)(this, "colours", ["rgba(194,210,224,1)", "rgba(235,214,219,1)", "rgba(255,211,45,1)", "rgba(255,190,174,1)", "rgba(255,173,226,1)", "rgba(242,114,171,1)", "rgba(228,55,116,1)", "rgba(255,86,130,1)", "rgba(244,36,57,1)", "rgba(247,126,157,1)", "rgba(243,142,140,1)", "rgba(252,116,183,1)"]);
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
      particle.color = this.colours[Math.random() * this.colours.length | 0];
      particle.x = Math.random() * width;
      particle.y = Math.random() * height + height;
      particle.xCol = particle.x;
      particle.scale = Math.random() * 0.07 + 0.04;
      particle.maximumDrift = Math.random() * this.options.maxDrift + 3.5;
      particle.maximumRot = Math.random() * this.options.maxRot + 3.5;
      particle.gravity = this.options.gravity + Math.random() * 4.8;
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
          this.animateAndRenderHearts();
        }
        requestAnimationFrame(this.renderLoop);
      }
    });
    this.options = _objectSpread(_objectSpread({}, DefaultOptions), options);
  }
  animateAndRenderHearts() {
    if (!this.context || !this.context.canvas) {
      return;
    }
    for (const particle of (0, _arrays.arrayFastClone)(this.particles)) {
      particle.y -= particle.gravity;

      // We treat the drift as a sine function to have a more fluid-like movement instead
      // of a pong-like movement off walls of the X column. This means that for
      // $x=A\sin(\frac{2\pi}{P}y)$ we use the `maximumDrift` as the amplitude (A) and a
      // large multiplier to create a very long waveform through P.
      const peakDistance = 75 * particle.maximumDrift;
      const PI2 = Math.PI * 2;
      particle.x = 6 * particle.maximumDrift * Math.sin(0.7 * (PI2 / peakDistance) * particle.y);
      particle.x += particle.xCol; // bring the particle to the right place

      const posScale = 1 / particle.scale;
      const x = particle.x * posScale;
      const y = particle.y * posScale;
      this.context.save();
      this.context.scale(particle.scale, particle.scale);
      this.context.beginPath();

      // Rotate the heart about its centre.
      // The tilt of the heart is modelled similarly to its horizontal drift,
      // using a sine function.
      this.context.translate(248 + x, 215 + y);
      this.context.rotate(1 / 10 * particle.maximumRot * Math.sin(PI2 / peakDistance * particle.y * 0.8));
      this.context.translate(-248 - x, -215 - y);

      // Use bezier curves to draw a heart using pre-calculated coordinates.
      this.context.moveTo(140 + x, 20 + y);
      this.context.bezierCurveTo(73 + x, 20 + y, 20 + x, 74 + y, 20 + x, 140 + y);
      this.context.bezierCurveTo(20 + x, 275 + y, 156 + x, 310 + y, 248 + x, 443 + y);
      this.context.bezierCurveTo(336 + x, 311 + y, 477 + x, 270 + y, 477 + x, 140 + y);
      this.context.bezierCurveTo(477 + x, 74 + y, 423 + x, 20 + y, 357 + x, 20 + y);
      this.context.bezierCurveTo(309 + x, 20 + y, 267 + x, 48 + y, 248 + x, 89 + y);
      this.context.bezierCurveTo(229 + x, 48 + y, 188 + x, 20 + y, 140 + x, 20 + y);
      this.context.closePath();
      this.context.fillStyle = particle.color;
      this.context.fill();
      this.context.restore();

      // Remove any dead hearts after a 100px wide margin.
      if (particle.y < -100) {
        const idx = this.particles.indexOf(particle);
        this.particles.splice(idx, 1);
      }
    }
  }
}
exports.default = Hearts;
//# sourceMappingURL=index.js.map