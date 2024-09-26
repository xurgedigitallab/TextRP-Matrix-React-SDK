"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CHAT_EFFECTS = void 0;
var _languageHandler = require("../languageHandler");
/*
 Copyright 2020 Nurjin Jafar
 Copyright 2020 Nordeck IT + Consulting GmbH.

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

/**
 * This configuration defines room effects that can be triggered by custom message types and emojis
 */
const CHAT_EFFECTS = [{
  emojis: ["🎊", "🎉"],
  msgType: "nic.custom.confetti",
  command: "confetti",
  description: () => (0, _languageHandler._td)("Sends the given message with confetti"),
  fallbackMessage: () => (0, _languageHandler._t)("sends confetti") + " 🎉",
  options: {
    maxCount: 150,
    speed: 3,
    frameInterval: 15,
    alpha: 1.0,
    gradient: false
  }
}, {
  emojis: ["🎆"],
  msgType: "nic.custom.fireworks",
  command: "fireworks",
  description: () => (0, _languageHandler._td)("Sends the given message with fireworks"),
  fallbackMessage: () => (0, _languageHandler._t)("sends fireworks") + " 🎆",
  options: {
    maxCount: 500,
    gravity: 0.05
  }
}, {
  emojis: ["🌧️", "⛈️", "🌦️"],
  msgType: "io.element.effect.rainfall",
  command: "rainfall",
  description: () => (0, _languageHandler._td)("Sends the given message with rainfall"),
  fallbackMessage: () => (0, _languageHandler._t)("sends rainfall") + " 🌧️",
  options: {
    maxCount: 600,
    speed: 10
  }
}, {
  emojis: ["❄", "🌨"],
  msgType: "io.element.effect.snowfall",
  command: "snowfall",
  description: () => (0, _languageHandler._td)("Sends the given message with snowfall"),
  fallbackMessage: () => (0, _languageHandler._t)("sends snowfall") + " ❄",
  options: {
    maxCount: 200,
    gravity: 0.05,
    maxDrift: 5
  }
}, {
  emojis: ["👾", "🌌"],
  msgType: "io.element.effects.space_invaders",
  command: "spaceinvaders",
  description: () => (0, _languageHandler._td)("Sends the given message with a space themed effect"),
  fallbackMessage: () => (0, _languageHandler._t)("sends space invaders") + " 👾",
  options: {
    maxCount: 50,
    gravity: 0.01
  }
}, {
  emojis: ["💝"],
  msgType: "io.element.effect.hearts",
  command: "hearts",
  description: () => (0, _languageHandler._td)("Sends the given message with hearts"),
  fallbackMessage: () => (0, _languageHandler._t)("sends hearts") + " 💝",
  options: {
    maxCount: 120,
    gravity: 3.2
  }
}];
exports.CHAT_EFFECTS = CHAT_EFFECTS;
//# sourceMappingURL=index.js.map