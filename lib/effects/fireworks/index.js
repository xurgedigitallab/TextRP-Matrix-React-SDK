"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.DefaultOptions = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
/*
 Copyright 2020 Nurjin Jafar
 Copyright 2020 Nordeck IT + Consulting GmbH.
 Copyright 2023 The Matrix.org Foundation C.I.C.

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
  maxCount: 500,
  gravity: 0.05
};
exports.DefaultOptions = DefaultOptions;
class Fireworks {
  constructor(options) {
    var _this = this;
    (0, _defineProperty2.default)(this, "options", void 0);
    (0, _defineProperty2.default)(this, "context", null);
    (0, _defineProperty2.default)(this, "supportsAnimationFrame", window.requestAnimationFrame);
    (0, _defineProperty2.default)(this, "particles", []);
    (0, _defineProperty2.default)(this, "isRunning", false);
    (0, _defineProperty2.default)(this, "start", async function (canvas) {
      let timeout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3000;
      if (!canvas) {
        return;
      }
      _this.isRunning = true;
      _this.context = canvas.getContext("2d");
      _this.supportsAnimationFrame.call(window, _this.updateWorld);
      if (timeout) {
        window.setTimeout(_this.stop, timeout);
      }
    });
    (0, _defineProperty2.default)(this, "updateWorld", () => {
      if (!this.isRunning && this.particles.length === 0) return;
      this.update();
      this.paint();
      this.supportsAnimationFrame.call(window, this.updateWorld);
    });
    (0, _defineProperty2.default)(this, "update", () => {
      if (this.particles.length < this.options.maxCount && this.isRunning) {
        this.createFirework();
      }
      const alive = [];
      for (let i = 0; i < this.particles.length; i++) {
        if (this.move(this.particles[i])) {
          alive.push(this.particles[i]);
        }
      }
      this.particles = alive;
    });
    (0, _defineProperty2.default)(this, "paint", () => {
      if (!this.context || !this.context.canvas) return;
      this.context.globalCompositeOperation = "destination-out";
      this.context.fillStyle = "rgba(0,0,0,0.5)";
      this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);
      this.context.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.particles.length; i++) {
        this.drawParticle(this.particles[i]);
      }
    });
    (0, _defineProperty2.default)(this, "createFirework", () => {
      if (!this.context || !this.context.canvas) return;
      const width = this.context.canvas.width;
      const height = this.context.canvas.height;
      const xPoint = Math.random() * (width - 200) + 100;
      const yPoint = Math.random() * (height - 200) + 100;
      const nFire = Math.random() * 50 + 100;
      const color = "rgb(" + ~~(Math.random() * 200 + 55) + "," + ~~(Math.random() * 200 + 55) + "," + ~~(Math.random() * 200 + 55) + ")";
      for (let i = 0; i < nFire; i++) {
        const particle = {};
        particle.color = color;
        particle.w = particle.h = Math.random() * 4 + 1;
        particle.x = xPoint - particle.w / 2;
        particle.y = yPoint - particle.h / 2;
        particle.vx = (Math.random() - 0.5) * 10;
        particle.vy = (Math.random() - 0.5) * 10;
        particle.alpha = Math.random() * 0.5 + 0.5;
        const vy = Math.sqrt(25 - particle.vx * particle.vx);
        if (Math.abs(particle.vy) > vy) {
          particle.vy = particle.vy > 0 ? vy : -vy;
        }
        this.particles.push(particle);
      }
    });
    (0, _defineProperty2.default)(this, "stop", async () => {
      this.isRunning = false;
    });
    (0, _defineProperty2.default)(this, "drawParticle", particle => {
      if (!this.context || !this.context.canvas) {
        return;
      }
      this.context.save();
      this.context.beginPath();
      this.context.translate(particle.x + particle.w / 2, particle.y + particle.h / 2);
      this.context.arc(0, 0, particle.w, 0, Math.PI * 2);
      this.context.fillStyle = particle.color;
      this.context.globalAlpha = particle.alpha;
      this.context.closePath();
      this.context.fill();
      this.context.restore();
    });
    (0, _defineProperty2.default)(this, "move", particle => {
      particle.x += particle.vx;
      particle.vy += this.options.gravity;
      particle.y += particle.vy;
      particle.alpha -= 0.01;
      return !(particle.x <= -particle.w || particle.x >= screen.width || particle.y >= screen.height || particle.alpha <= 0);
    });
    this.options = _objectSpread(_objectSpread({}, DefaultOptions), options);
  }
}
exports.default = Fireworks;
//# sourceMappingURL=index.js.map