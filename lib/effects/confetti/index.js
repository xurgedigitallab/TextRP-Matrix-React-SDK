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
  maxCount: 150,
  speed: 3,
  frameInterval: 15,
  alpha: 1.0,
  gradient: false
};
exports.DefaultOptions = DefaultOptions;
class Confetti {
  constructor(options) {
    var _this = this;
    (0, _defineProperty2.default)(this, "options", void 0);
    (0, _defineProperty2.default)(this, "context", null);
    (0, _defineProperty2.default)(this, "supportsAnimationFrame", window.requestAnimationFrame);
    (0, _defineProperty2.default)(this, "colors", ["rgba(30,144,255,", "rgba(107,142,35,", "rgba(255,215,0,", "rgba(255,192,203,", "rgba(106,90,205,", "rgba(173,216,230,", "rgba(238,130,238,", "rgba(152,251,152,", "rgba(70,130,180,", "rgba(244,164,96,", "rgba(210,105,30,", "rgba(220,20,60,"]);
    (0, _defineProperty2.default)(this, "lastFrameTime", Date.now());
    (0, _defineProperty2.default)(this, "particles", []);
    (0, _defineProperty2.default)(this, "waveAngle", 0);
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
      _this.runAnimation();
      if (timeout) {
        window.setTimeout(_this.stop, timeout);
      }
    });
    (0, _defineProperty2.default)(this, "stop", async () => {
      this.isRunning = false;
    });
    (0, _defineProperty2.default)(this, "resetParticle", (particle, width, height) => {
      particle.color = this.colors[Math.random() * this.colors.length | 0] + (this.options.alpha + ")");
      if (this.options.gradient) {
        particle.color2 = this.colors[Math.random() * this.colors.length | 0] + (this.options.alpha + ")");
      } else {
        particle.color2 = particle.color;
      }
      particle.x = Math.random() * width;
      particle.y = Math.random() * -height;
      particle.diameter = Math.random() * 10 + 5;
      particle.tilt = Math.random() * -10;
      particle.tiltAngleIncrement = Math.random() * 0.07 + 0.05;
      particle.tiltAngle = Math.random() * Math.PI;
      return particle;
    });
    (0, _defineProperty2.default)(this, "runAnimation", () => {
      if (!this.context || !this.context.canvas) {
        return;
      }
      if (this.particles.length === 0) {
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
      } else {
        const now = Date.now();
        const delta = now - this.lastFrameTime;
        if (!this.supportsAnimationFrame || delta > this.options.frameInterval) {
          this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
          this.updateParticles();
          this.drawParticles(this.context);
          this.lastFrameTime = now - delta % this.options.frameInterval;
        }
        requestAnimationFrame(this.runAnimation);
      }
    });
    (0, _defineProperty2.default)(this, "drawParticles", context => {
      if (!this.context || !this.context.canvas) {
        return;
      }
      let x;
      let x2;
      let y2;
      for (const particle of this.particles) {
        this.context.beginPath();
        context.lineWidth = particle.diameter;
        x2 = particle.x + particle.tilt;
        x = x2 + particle.diameter / 2;
        y2 = particle.y + particle.tilt + particle.diameter / 2;
        if (this.options.gradient) {
          const gradient = context.createLinearGradient(x, particle.y, x2, y2);
          gradient.addColorStop(0, particle.color);
          gradient.addColorStop(1.0, particle.color2);
          context.strokeStyle = gradient;
        } else {
          context.strokeStyle = particle.color;
        }
        context.moveTo(x, particle.y);
        context.lineTo(x2, y2);
        context.stroke();
      }
    });
    (0, _defineProperty2.default)(this, "updateParticles", () => {
      if (!this.context || !this.context.canvas) {
        return;
      }
      const width = this.context.canvas.width;
      const height = this.context.canvas.height;
      let particle;
      this.waveAngle += 0.01;
      for (let i = 0; i < this.particles.length; i++) {
        particle = this.particles[i];
        if (!this.isRunning && particle.y < -15) {
          particle.y = height + 100;
        } else {
          particle.tiltAngle += particle.tiltAngleIncrement;
          particle.x += Math.sin(this.waveAngle) - 0.5;
          particle.y += (Math.cos(this.waveAngle) + particle.diameter + this.options.speed) * 0.5;
          particle.tilt = Math.sin(particle.tiltAngle) * 15;
        }
        if (particle.x > width + 20 || particle.x < -20 || particle.y > height) {
          if (this.isRunning && this.particles.length <= this.options.maxCount) {
            this.resetParticle(particle, width, height);
          } else {
            this.particles.splice(i, 1);
            i--;
          }
        }
      }
    });
    this.options = _objectSpread(_objectSpread({}, DefaultOptions), options);
  }
}
exports.default = Confetti;
//# sourceMappingURL=index.js.map